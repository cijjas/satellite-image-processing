"""
Pipeline v2 — Dashboard-ready JSON exporter (UPDATED with new vegetation indices)
===============================================================================
This script builds on the original Earth Engine workflow and adds **richer
outputs** so a front-end can render a full dashboard from a **single JSON file**.

**⚠️  CHANGES IN THIS VERSION**
--------------------------------
• Replaced the previous set of indices (NDRE, GNDVI, NDWI) with the user-supplied list.
• Added new spectral indices:
    · NDVI  (Normalized Difference NIR/Red — unchanged)
    · SAVI  (Soil Adjusted Vegetation Index — L = 0.5)
    · GLI   (Green Leaf Index)
    · ND_800_680  (Normalized Difference 800/680 nm)
    · CCCI (Canopy Chlorophyll Content Index — NIR/Red-edge)
    · ND_790_670  (Normalized Difference 790/670 nm)
    · ND_790_720  (Normalized Difference 790/720 nm)
• Updated all loops / reducers / threshold dict to reflect the new band names.
• Latest-image tile is now generated from **NDVI** (still the most common backdrop).

"""

import os
import json
from datetime import date, timedelta, datetime, timezone

import ee
import geemap
import geopandas as gpd
import numpy as np
import pandas as pd

# ──────────────────────────────────────────────────────────────
# USER PARAMETERS — edit as required
# ──────────────────────────────────────────────────────────────
AOI_GEOJSON   = '../data/geojson/campo-bruzo.geojson'          # main field boundary
ZONES_GEOJSON = None                                           # optional sub-zones
DATE_START    = '2020-01-01'
DATE_END      = date.today().strftime('%Y-%m-%d')
CLOUD_MAX_PCT = 5                                              # % cloud filter
THRESHOLDS = {                                                 # alert / area rules
    'NDVI'       : [0.40, 0.60],
    'SAVI'       : [0.30],
    'ND_800_680' : [0.30],
    'CCCI'       : [0.30],
}
PREDICT_WINDOW = 10        # how many recent obs to fit regression
OUT_DIR        = '../output/dashboard'

# ──────────────────────────────────────────────────────────────
# INITIALISE EE & READ GEOMETRIES
# ──────────────────────────────────────────────────────────────
ee.Authenticate()  # comment out if running on a machine already authenticated
ee.Initialize()

# Load AOI as EE geometry
print('➡️  Loading AOI…')
aoi_gdf = gpd.read_file(AOI_GEOJSON)
aoi_fc  = geemap.geopandas_to_ee(aoi_gdf)
aoi_geom = aoi_fc.geometry()

# Optional zones layer (must have a column called "zone" or "id")
if ZONES_GEOJSON and os.path.isfile(ZONES_GEOJSON):
    zones_gdf = gpd.read_file(ZONES_GEOJSON)
    # Ensure there is an id column
    if 'zone' not in zones_gdf.columns and 'id' not in zones_gdf.columns:
        zones_gdf['zone'] = zones_gdf.index.astype(str)
    zones_fc = geemap.geopandas_to_ee(zones_gdf)
    USE_ZONES = True
    print(f'   Loaded {len(zones_gdf)} management zones.')
else:
    zones_fc = None
    USE_ZONES = False
    print('   No management zones supplied → zone stats will be skipped.')

# ──────────────────────────────────────────────────────────────
# BUILD SENTINEL-2 COLLECTION WITH INDICES
# ──────────────────────────────────────────────────────────────
print('➡️  Building Sentinel-2 ImageCollection…')
s2 = (
    ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi_geom)
    .filterDate(DATE_START, DATE_END)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', CLOUD_MAX_PCT))
)

# Add the new spectral indices to every image
def add_indices(img):
    """Attach all required spectral indices to a Sentinel-2 image."""
    # 1. Normalised Difference NIR / Red  (standard NDVI)
    ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI')

    # 2. Soil-Adjusted Vegetation Index (L = 0.5)
    savi = img.expression(
        '((NIR - RED) / (NIR + RED + L)) * (1 + L)',
        {
            'NIR': img.select('B8'),
            'RED': img.select('B4'),
            'L'  : 0.5,
        },
    ).rename('SAVI')

    # 3. Green Leaf Index (Gitelson et al.)
    gli = img.expression(
        '((2 * G) - R - B) / ((2 * G) + R + B)',
        {
            'G': img.select('B3'),
            'R': img.select('B4'),
            'B': img.select('B2'),
        },
    ).rename('GLI')

    # 4. Normalised Difference 800/680 nm (using B8 ≈ 842 nm, B5 ≈ 705 nm)
    nd_800_680 = img.normalizedDifference(['B8', 'B5']).rename('ND_800_680')

    # 5. Canopy Chlorophyll Content Index (NIR / red-edge)
    ccci = img.normalizedDifference(['B8', 'B5']).rename('CCCI')

    # 6. Normalised Difference 790/670 nm (B7 ≈ 783 nm, B4 ≈ 665 nm)
    nd_790_670 = img.normalizedDifference(['B7', 'B4']).rename('ND_790_670')

    # 7. Normalised Difference 790/720 nm (B7 ≈ 783 nm, B6 ≈ 740 nm)
    nd_790_720 = img.normalizedDifference(['B7', 'B6']).rename('ND_790_720')

    return (
        img.addBands([
            ndvi,
            savi,
            gli,
            nd_800_680,
            ccci,
            nd_790_670,
            nd_790_720,
        ])
        .copyProperties(img, ['system:time_start'])
    )

idx_col = (
    s2.map(add_indices)
    .sort('system:time_start', True)  # oldest → newest
)
print(f'   Collection length: {idx_col.size().getInfo()} images')

# List of all index band names we'll work with everywhere below
INDEX_BANDS = [
    'NDVI',
    'SAVI',
    'GLI',
    'ND_800_680',
    'CCCI',
    'ND_790_670',
    'ND_790_720',
]

# ──────────────────────────────────────────────────────────────
# PER-IMAGE AOI STATISTICS
# ──────────────────────────────────────────────────────────────
print('➡️  Computing per-image statistics (whole AOI)…')

def reducer_full():
    """Combined reducer: mean, min, max, stdDev for a single band."""
    return (
        ee.Reducer.mean()
        .combine(ee.Reducer.min(), sharedInputs=True)
        .combine(ee.Reducer.max(), sharedInputs=True)
        .combine(ee.Reducer.stdDev(), sharedInputs=True)
    )

# Function to create per-image feature with AOI metrics
def img_stats(img):
    props = {'date': img.date().format('YYYY-MM-dd')}
    for band in INDEX_BANDS:
        b = img.select(band)
        stats = b.reduceRegion(
            reducer   = reducer_full(),
            geometry  = aoi_geom,
            scale     = 10,
            maxPixels = 1e13,
        )
        # Unpack stats
        props.update({
            f'{band}_mean': stats.get(f'{band}_mean'),
            f'{band}_min' : stats.get(f'{band}_min'),
            f'{band}_max' : stats.get(f'{band}_max'),
            f'{band}_std' : stats.get(f'{band}_stdDev'),
        })
        # Area/percentage above thresholds
        if band in THRESHOLDS:
            for thr in THRESHOLDS[band]:
                mask      = b.gt(thr)
                area_m2   = mask.multiply(ee.Image.pixelArea()).reduceRegion(
                    reducer   = ee.Reducer.sum(),
                    geometry  = aoi_geom,
                    scale     = 10,
                    maxPixels = 1e13,
                ).values().get(0)
                thr_str = str(thr).replace('.', '_')
                props[f'area_{band}_{thr_str}'] = area_m2
    return ee.Feature(None, props)

stats_fc   = idx_col.map(img_stats)
stats_dict = [f['properties'] for f in stats_fc.getInfo()['features']]

aoi_df = pd.DataFrame(stats_dict)
aoi_df['date'] = pd.to_datetime(aoi_df['date'])
aoi_df = aoi_df.sort_values('date')

# Convert area columns m²→km² and fill-na with 0
for col in aoi_df.columns:
    if col.startswith('area_'):
        aoi_df[col] = aoi_df[col].astype(float).div(1e6).round(4)  # km²

aoi_df.fillna(value=np.nan, inplace=True)

# ──────────────────────────────────────────────────────────────
# PER-ZONE STATISTICS (mean only)
# ──────────────────────────────────────────────────────────────
if USE_ZONES:
    print('➡️  Computing per-zone averages…')
    def zonal_stats(img):
        """Returns a FeatureCollection with one feature per zone & date."""
        mean_reducer = ee.Reducer.mean()
        fc = img.reduceRegions(
            collection = zones_fc,
            reducer    = mean_reducer,
            scale      = 10,
        ).map(lambda f: f.set({'date': img.date().format('YYYY-MM-dd')}))
        return fc

    zone_img_fc = idx_col.map(zonal_stats).flatten()
    zones_dict = zone_img_fc.getInfo()['features']
    zone_df = pd.json_normalize(zones_dict)
    # Rename columns nicely: properties.<band>_mean → <band>
    zone_df = zone_df.rename(columns=lambda c: c.split('.')[-1])
    zone_df['date'] = pd.to_datetime(zone_df['date'])
    zone_df = zone_df.sort_values(['id', 'date'])
else:
    zone_df = pd.DataFrame()

# ──────────────────────────────────────────────────────────────
# TREND-BASED PREDICTIONS & ALERTS
# ──────────────────────────────────────────────────────────────
print('➡️  Generating simple linear predictions & alerts…')

predictions = {}
alerts      = []
latest_date = aoi_df['date'].max()
next_date   = latest_date + timedelta(days=10)

for band in INDEX_BANDS:
    col = f'{band}_mean'
    if col not in aoi_df.columns:
        continue
    series = aoi_df[[col]].dropna().tail(PREDICT_WINDOW)
    if len(series) < 2:
        continue  # not enough points to fit
    y = series[col].values.astype(float)
    x = np.arange(len(y))
    slope, intercept = np.polyfit(x, y, 1)
    pred = float(slope * (len(y)) + intercept)
    predictions[band] = {
        'predicted_on' : next_date.strftime('%Y-%m-%d'),
        'value'        : round(pred, 4),
        'trend_slope'  : round(slope, 5),
    }
    # Simple alert rules
    if band in THRESHOLDS:
        low_thr = THRESHOLDS[band][0]
        latest_val = float(aoi_df.iloc[-1][col])
        if latest_val < low_thr:
            alerts.append({
                'date'  : latest_date.strftime('%Y-%m-%d'),
                'index' : band,
                'value' : round(latest_val, 4),
                'type'  : 'low',
                'msg'   : f'{band} dropped below {low_thr}',
            })

# ──────────────────────────────────────────────────────────────
# LATEST NDVI TILE URL (for backdrop)
# ──────────────────────────────────────────────────────────────
latest_img = idx_col.sort('system:time_start', False).first()
ndvi_latest = latest_img.select('NDVI')
map_id = ndvi_latest.getMapId({'min': 0, 'max': 1, 'palette': ['brown', 'yellow', 'green']})
tile_url = f"https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/{map_id['mapid']}/tiles/{{z}}/{{x}}/{{y}}?token={map_id['token']}"

# ──────────────────────────────────────────────────────────────
# CONSOLIDATE → ONE JSON
# ──────────────────────────────────────────────────────────────
print('➡️  Writing consolidated JSON…')
os.makedirs(OUT_DIR, exist_ok=True)

output = {
    'generated' : datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'parameters': {
        'aoi_geojson'  : os.path.abspath(AOI_GEOJSON),
        'zones_geojson': os.path.abspath(ZONES_GEOJSON) if ZONES_GEOJSON else None,
        'date_start'   : DATE_START,
        'date_end'     : DATE_END,
        'cloud_max_pct': CLOUD_MAX_PCT,
        'thresholds'   : THRESHOLDS,
    },
    'aoi'         : json.loads(gpd.read_file(AOI_GEOJSON).to_json())['features'][0],
    'timeseries'  : aoi_df.to_dict(orient='records'),
    'tile_url'    : tile_url,
    'predictions' : predictions,
    'alerts'      : alerts,
}

if USE_ZONES and not zone_df.empty:
    # package zone stats as nested dict {zone_id: [records…]}
    zones_package = {}
    for zid, group in zone_df.groupby('zone'):
        zones_package[str(zid)] = group.sort_values('date').to_dict(orient='records')
    output['zones'] = zones_package

with open(os.path.join(OUT_DIR, 'dashboard_data.json'), 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2, default=str)

print(f'✅ dashboard_data.json written to {OUT_DIR}')
