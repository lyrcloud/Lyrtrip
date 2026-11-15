'use client';

import { memo, useEffect, useRef, useState } from 'react';

export interface StayPin { id: string; lat: number; lng: number; price: string; name: string; imageUrl?: string | null; sub?: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
// Airbnb-style map: a price pill per stay; the selected or hovered stay's pill turns dark and comes to the front.
// Pills are HTML overlays (OverlayView), so they need no map ID and look the same on every device.
function StayMapInner({ pins, selectedId, hoverId, onSelect, height = 'h-[32rem]' }: {
  pins: StayPin[]; selectedId: string | null; hoverId?: string | null; onSelect: (id: string) => void; height?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const overlays = useRef<Map<string, { el: HTMLDivElement; ov: any }>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; });

  // Build the map and the pills whenever the set of stays changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const g = (window as any).google;
      if (!g?.maps?.importLibrary) { setError('The map could not load.'); return; }
      const { Map: GMap, OverlayView } = await g.maps.importLibrary('maps');
      if (cancelled || !box.current) return;
      if (!map.current) {
        map.current = new GMap(box.current, {
          center: { lat: pins[0]?.lat ?? 0, lng: pins[0]?.lng ?? 0 }, zoom: 12, clickableIcons: false,
          mapTypeControl: false, streetViewControl: false, fullscreenControl: true, gestureHandling: 'cooperative',
        });
      }
      overlays.current.forEach(o => o.ov.setMap(null));
      overlays.current.clear();
      const bounds = new g.maps.LatLngBounds();
      for (const p of pins) {
        const el = document.createElement('div');
        el.className = 'stay-pin';
        el.textContent = p.price;
        el.title = p.name;
        el.addEventListener('click', e => { e.stopPropagation(); onSelectRef.current(p.id); });
        const ov = new OverlayView();
        ov.onAdd = function onAdd(this: any) { this.getPanes().overlayMouseTarget.appendChild(el); };
        ov.draw = function draw(this: any) {
          const pt = this.getProjection()?.fromLatLngToDivPixel(new g.maps.LatLng(p.lat, p.lng));
          if (pt) { el.style.left = `${pt.x}px`; el.style.top = `${pt.y}px`; }
        };
        ov.onRemove = () => el.remove();
        ov.setMap(map.current);
        overlays.current.set(p.id, { el, ov });
        bounds.extend({ lat: p.lat, lng: p.lng });
      }
      if (pins.length > 1) map.current.fitBounds(bounds, 48);
      else if (pins.length === 1) { map.current.setCenter({ lat: pins[0].lat, lng: pins[0].lng }); map.current.setZoom(14); }
    })().catch(() => setError('The map could not load.'));
    return () => { cancelled = true; };
  }, [pins]);

  // Highlight without rebuilding
  useEffect(() => {
    overlays.current.forEach((o, id) => {
      o.el.classList.toggle('stay-pin-active', id === selectedId);
      o.el.classList.toggle('stay-pin-hover', id === hoverId && id !== selectedId);
    });
    const sel = selectedId ? pins.find(p => p.id === selectedId) : null;
    if (sel && map.current) map.current.panTo({ lat: sel.lat, lng: sel.lng });
  }, [selectedId, hoverId, pins]);

  if (error) return <div className={`${height} w-full rounded-2xl bg-gray-100 flex items-center justify-center text-sm text-gray-500`}>{error}</div>;
  return <div ref={box} className={`${height} w-full rounded-2xl overflow-hidden ring-1 ring-gray-200`} />;
}

const StayMap = memo(StayMapInner);
export default StayMap;
