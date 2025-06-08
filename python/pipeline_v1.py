# ──────────────────────────────────────────────────────────────
# BLOQUE 1 — CARGAR LIBRERIAS Y PARAMETROS DE USUARIO
# ──────────────────────────────────────────────────────────────

import os
import json
import ee
import geemap
import geopandas as gpd
import pandas as pd
from datetime import date
from datetime import datetime

# ▸ Parametros que puedes editar:
AOI_GEOJSON   = '../data/geojson/campo-bruzo.geojson'   # ← geojson del AOI
DATE_START    = '2024-01-01'                           # ← fecha inicial
DATE_END      = date.today().strftime('%Y-%m-%d')      # ← fecha final
CLOUD_MAX_PCT = 5                                      # ← % nubes máximo
THRESHOLDS = {                                         # ← umbrales para métricas de area
    'NDVI': [0.40, 0.60],
    'NDWI': [0.05],
    'NDRE': [0.30]
}

# ──────────────────────────────────────────────────────────────
# BLOQUE 2 — CONECTARSE A EARTH ENGINE Y LEER EL AOI
# ──────────────────────────────────────────────────────────────

ee.Authenticate()
ee.Initialize()

# Leer AOI como FeatureCollection de EE
aoi_gdf = gpd.read_file(AOI_GEOJSON)
aoi_fc  = geemap.geopandas_to_ee(aoi_gdf)
aoi_geom = aoi_fc.geometry()


# ──────────────────────────────────────────────────────────────
# BLOQUE 3 — CONSTRUIR LA COLECCION DE IMAGENES
# ──────────────────────────────────────────────────────────────

# Sentinel-2 SR con filtros básicos
# stack of images
s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') # "SR" = Surface Reflectance → atmospherically corrected → best for vegetation indices.
      .filterBounds(aoi_geom)
      .filterDate(DATE_START, DATE_END)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', CLOUD_MAX_PCT)))

# Añadir índices a cada imagen
def add_indices(img):
    ndvi  = img.normalizedDifference(['B8',  'B4']).rename('NDVI')
    ndre  = img.normalizedDifference(['B8',  'B5']).rename('NDRE')
    gndvi = img.normalizedDifference(['B8',  'B3']).rename('GNDVI')
    ndwi  = img.normalizedDifference(['B8', 'B11']).rename('NDWI')
    savi  = img.expression(
        '((NIR - RED) / (NIR + RED + L)) * (1 + L)',
        {'NIR': img.select('B8'), 'RED': img.select('B4'), 'L': 0.5}
    ).rename('SAVI')
    return (img.addBands([ndvi, ndre, gndvi, ndwi, savi])
               .copyProperties(img, ['system:time_start']))

idx_col = (s2.map(add_indices)
             .sort('system:time_start', True))  # oldest→newest



# ──────────────────────────────────────────────────────────────
# BLOQUE 4 — COMPUTAR ESTADISTICAS POR IMAGEN
# ──────────────────────────────────────────────────────────────


# Mean, Min, Max, Std of each index → "how the field is doing overall"
# Area (km²) where index > threshold → "how much of my field is green / healthy / well watered"
def img_stats(img):
    props = {'date': img.date().format('YYYY-MM-dd')}
    for band in ['NDVI', 'NDRE', 'GNDVI', 'NDWI', 'SAVI']:
        b = img.select(band)
        stats = b.reduceRegion(
            reducer = ee.Reducer.mean()
                       .combine(ee.Reducer.min(),  sharedInputs=True)
                       .combine(ee.Reducer.max(),  sharedInputs=True)
                       .combine(ee.Reducer.stdDev(), sharedInputs=True),
            geometry = aoi_geom,
            scale    = 10,
            maxPixels = 1e13
        )
        props.update({
            f'{band}_mean':  stats.get('NDVI' if band=='NDVI' else band, ee.Number(0)),
            f'{band}_min' :  stats.get(f'{band}_min', ee.Number(0)),
            f'{band}_max' :  stats.get(f'{band}_max', ee.Number(0)),
            f'{band}_std' :  stats.get(f'{band}_stdDev', ee.Number(0))
        })
        # areas por umbral
        if band in THRESHOLDS:
            for thr in THRESHOLDS[band]:
                mask       = b.gt(thr)
                area_m2    = mask.multiply(ee.Image.pixelArea())\
                                .reduceRegion(
                                    reducer=ee.Reducer.sum(),
                                    geometry=aoi_geom,
                                    scale   =10,
                                    maxPixels=1e13
                                ).get(mask.bandNames().get(0), ee.Number(0))
                # convert thr to safe string (replace dot with underscore)
                thr_str = str(thr).replace('.', '_')
                props[f'area_{band}_{thr_str}'] = area_m2

    return ee.Feature(None, props)


# Mapear sobre la colección completa
# idx_col = Sentinel-2 ImageCollection → each image has:
#     - bands B2-B12
#     - indices: NDVI, NDRE, GNDVI, NDWI, SAVI
#     + {'date', 'NDVI_mean', 'NDVI_min', ..., 'area_NDVI_0_4', ...}

stats_fc   = idx_col.map(img_stats)  
stats_dict = [f['properties'] for f in stats_fc.getInfo()['features']]


# ──────────────────────────────────────────────────────────────
# BLOQUE 5 — CONVERTIR A DATAFRAME Y GUARDAR
# ──────────────────────────────────────────────────────────────

# DataFrame ordenado por fecha
df = pd.DataFrame(stats_dict)
df['date'] = pd.to_datetime(df['date'])
df = df.sort_values('date')

# Conversión de áreas a km²
for col in df.columns:
    if col.startswith('area_'):
        df[col] = df[col].astype(float) / 1e6   # m² → km²

# Guardar
out_dir = '../output/dashboard'
os.makedirs(out_dir, exist_ok=True)
df.to_json(f'{out_dir}/time_series_stats.json', orient='records', date_format='iso')
df.to_csv (f'{out_dir}/time_series_stats.csv', index=False)

print(f'✅ Exportados {len(df)} registros a {out_dir}/time_series_stats.(json|csv)')