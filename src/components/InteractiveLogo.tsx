'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const MAX_TILT = 10; // degrees

/**
 * Nav logo that tilts toward the cursor and pops when clicked
 */
export default function InteractiveLogo() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const [popKey, setPopKey] = useState(0);

  const onMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || e.pointerType !== 'mouse') return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -py * MAX_TILT * 2, y: px * MAX_TILT * 2 });
  };

  const reset = () => { setHover(false); setTilt({ x: 0, y: 0 }); };

  return (
    <Link
      ref={ref}
      href="/"
      aria-label="Lyrtrip home"
      onPointerEnter={() => setHover(true)}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onClick={() => setPopKey(k => k + 1)}
      className="group relative flex items-center rounded-xl px-1 py-1 [perspective:600px] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
    >
      {/* Soft brand glow behind the logo on hover */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-xl bg-brand-100 blur-md transition-opacity duration-300 ${hover ? 'opacity-70' : 'opacity-0'}`}
      />
      <span
        key={popKey}
        className={`relative block transition-transform duration-200 ease-out ${popKey ? 'animate-[logoPop_450ms_ease-out]' : ''}`}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hover ? 1.06 : 1})` }}
      >
        <Image
          src="/logo.png"
          alt="Lyrtrip"
          width={160}
          height={56}
          priority
          className="h-11 sm:h-12 w-auto object-contain drop-shadow-sm"
        />
      </span>
    </Link>
  );
}
