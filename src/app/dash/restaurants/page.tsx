'use client';

import { useEffect } from 'react';

// Old link: the Dash tab is now same-day courier delivery
export default function DashRestaurantsPage() {
  useEffect(() => { window.location.replace('/?tab=dash'); }, []);
  return null;
}
