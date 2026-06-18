'use client';

import React, { useEffect, useRef, useState } from 'react';

interface LocationMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  title?: string;
}

export default function LocationMap({ lat, lng, zoom = 12, title = 'Location' }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      if (!mapRef.current) return;

      try {
        const g = (window as any).google;
        if (!g?.maps?.importLibrary) {
          if (mounted) setMapError('Google Maps failed to load. Check your API key.');
          return;
        }

        const { Map } = await g.maps.importLibrary('maps') as google.maps.MapsLibrary;
        const { Marker } = await g.maps.importLibrary('marker') as google.maps.MarkerLibrary;

        if (!mounted || !mapRef.current) return;

        const map = new Map(mapRef.current, { center: { lat, lng }, zoom });
        new Marker({ position: { lat, lng }, map, title });
      } catch (err) {
        console.error('Map init error:', err);
        if (mounted) setMapError('Failed to initialize map.');
      }
    }

    initMap();
    return () => { mounted = false; };
  }, [lat, lng, zoom, title]);

  if (mapError) {
    return (
      <div className="w-full h-96 rounded-lg shadow-md bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-sm">{mapError}</p>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-96 rounded-lg shadow-md" />;
}
