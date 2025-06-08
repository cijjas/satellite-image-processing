'use client';

import { useEffect, useRef } from 'react';

interface AOI {
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    name: string;
  };
}

interface AOIMapProps {
  aoi: AOI;
  tileUrl: string;
}

export function AOIMap({ aoi }: AOIMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || !aoi.geometry.coordinates[0]) return;

    // Calculate bounds from coordinates
    const coords = aoi.geometry.coordinates[0];
    const lats = coords.map(coord => coord[1]);
    const lngs = coords.map(coord => coord[0]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Create a simple map visualization
    const mapContainer = mapRef.current;
    mapContainer.innerHTML = `
      <div class="relative w-full h-64 bg-slate-100 rounded-lg overflow-hidden border">
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center space-y-2">
            <div class="text-sm font-medium text-slate-700">${
              aoi.properties.name
            }</div>
            <div class="text-xs text-slate-500">
              Center: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}
            </div>
            <div class="text-xs text-slate-500">
              Area: ${coords.length} coordinates
            </div>
            <div class="w-16 h-16 mx-auto bg-green-200 border-2 border-green-400 rounded-lg flex items-center justify-center">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
          </div>
        </div>
        <div class="absolute bottom-2 left-2 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded">
          Satellite View
        </div>
      </div>
    `;
  }, [aoi]);

  return <div ref={mapRef} className='w-full' />;
}
