'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Food, grocery and pickup orders are placed and paid on Uber Eats; Lyrtrip doesn't take orders itself yet.
export default function UberEatsRedirect({ title, emoji, path }: { title: string; emoji: string; path: string }) {
  const [where, setWhere] = useState('');
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(p => setWhere(`pl=${p.coords.latitude},${p.coords.longitude}`), () => {});
  }, []);
  const href = `https://www.ubereats.com/${path}${where ? `${path.includes('?') ? '&' : '?'}${where}` : ''}`;
  return (
    <div className="flex-1 bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <p className="text-5xl mb-3">{emoji}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 mb-6">Order from places near you on Uber Eats. You order and pay on Uber Eats; Lyrtrip doesn&apos;t charge you.</p>
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="block w-full py-3 bg-[#06C167] text-white font-semibold rounded-xl hover:opacity-90">Open Uber Eats →</a>
        <Link href="/?tab=dash" className="block mt-3 text-sm text-gray-500 hover:text-gray-700">Back to Lyrtrip</Link>
      </div>
    </div>
  );
}
