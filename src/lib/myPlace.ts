// The visitor's current place for "near me" options: GPS position plus a readable
// address and city from Google's geocoder, cached for the tab's session.

export interface MyPlace { lat: number; lng: number; address: string; city: string }

const KEY = 'lyrtrip_my_place';
const MAX_AGE_MS = 10 * 60 * 1000;
let pending: Promise<MyPlace> | null = null;

function cached(): MyPlace | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return v && Date.now() - v.at < MAX_AGE_MS ? v.place : null;
  } catch {
    return null;
  }
}

/** True when the browser already allows location, so asking won't show a prompt */
export async function locationAllowed(): Promise<boolean> {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted';
  } catch {
    return false;
  }
}

/** Asks for the position if needed. Throws with a message to show. */
export function getMyPlace(): Promise<MyPlace> {
  const hit = typeof window !== 'undefined' ? cached() : null;
  if (hit) return Promise.resolve(hit);
  pending ??= new Promise<MyPlace>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is not available on this device')); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      let address = 'Current location', city = '';
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (key) {
        try {
          const data = await (await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`)).json();
          const results: { formatted_address: string; types: string[]; address_components: { long_name: string; types: string[] }[] }[] = data.results ?? [];
          if (results[0]) address = results[0].formatted_address;
          const comps = results[0]?.address_components ?? [];
          const part = (t: string) => comps.find(c => c.types.includes(t))?.long_name;
          const locality = results.find(r => r.types.includes('locality'))?.formatted_address;
          city = locality ?? [part('locality') ?? part('administrative_area_level_2'), part('administrative_area_level_1'), part('country')].filter(Boolean).join(', ');
        } catch { /* the coordinates still work */ }
      }
      const place = { lat, lng, address, city: city || address };
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), place })); } catch { /* storage blocked */ }
      resolve(place);
    }, err => reject(new Error(err.code === err.PERMISSION_DENIED
      ? 'Location is blocked. Allow it for Lyrtrip in your browser or phone settings.'
      : 'Could not find your location. Try again or type a place.')),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  }).finally(() => { pending = null; });
  return pending;
}
