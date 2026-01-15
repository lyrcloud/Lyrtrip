'use client';

import React, { useEffect, useRef } from 'react';

interface LocationMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  title?: string;
}

/**
 * LocationMap component displays a Google Map with a marker at the specified location
 */
export default function LocationMap({ 
  lat, 
  lng, 
  zoom = 12,
  title = 'Location'
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom,
    });

    new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstance.current,
      title,
    });
  }, [lat, lng, zoom, title]);

  return <div ref={mapRef} className="w-full h-96 rounded-lg shadow-md" />;
}