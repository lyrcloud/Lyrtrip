// Per-tab icon animations (Web Animations API), played on hover, click and arrow-key selection
export type IconMotion = { frames: Keyframe[]; duration: number; easing?: string; puff?: string };
export const ICON_MOTION: Record<string, IconMotion> = {
  flights: { duration: 1100, easing: 'ease-in-out', frames: [
    { transform: 'translate(0,0) rotate(0)', opacity: 1 },
    { transform: 'translate(8px,4px) rotate(4deg)', offset: 0.12 },
    { transform: 'translate(90px,-60px) rotate(-12deg) scale(0.7)', opacity: 0, offset: 0.45 },
    { transform: 'translate(-90px,50px) rotate(-12deg) scale(0.7)', opacity: 0, offset: 0.46 },
    { transform: 'translate(0,0) rotate(0)', opacity: 1 },
  ] },
  shipping: { duration: 800, easing: 'ease-out', frames: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-36px) rotate(-8deg)', offset: 0.3 },
    { transform: 'translateY(0) scale(1.15,0.85)', offset: 0.55 },
    { transform: 'translateY(-10px) scale(0.95,1.05)', offset: 0.75 },
    { transform: 'translateY(0) scale(1)' },
  ] },
  hotels: { duration: 800, easing: 'ease-out', frames: [
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.3) translateY(-6px)', filter: 'brightness(1.3) drop-shadow(0 0 10px rgb(250 204 21))', offset: 0.4 },
    { transform: 'scale(0.95)', offset: 0.7 },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ] },
  car: { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-3px) rotate(-2deg)', offset: 0.1 },
    { transform: 'translateX(3px) rotate(2deg)', offset: 0.2 },
    { transform: 'translateX(-3px)', offset: 0.3 },
    { transform: 'translateY(-14px) rotate(-6deg)', offset: 0.55 },
    { transform: 'translateY(0) scale(1.08,0.92)', offset: 0.8 },
    { transform: 'translateY(0) scale(1)' },
  ] },
  bus: { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-8px) rotate(-3deg)', offset: 0.25 },
    { transform: 'translateY(0) rotate(2deg)', offset: 0.5 },
    { transform: 'translateY(-5px) rotate(-1deg)', offset: 0.75 },
    { transform: 'translateY(0) rotate(0)' },
  ] },
  train: { duration: 1000, easing: 'linear', puff: '💨', frames: [
    { transform: 'translate(0,0)' },
    { transform: 'translate(2px,-3px)', offset: 0.15 },
    { transform: 'translate(-2px,0)', offset: 0.3 },
    { transform: 'translate(2px,-3px)', offset: 0.45 },
    { transform: 'translate(-2px,0)', offset: 0.6 },
    { transform: 'translate(2px,-3px)', offset: 0.75 },
    { transform: 'translate(0,0)' },
  ] },
  cruise: { duration: 1200, easing: 'ease-in-out', puff: '🌊', frames: [
    { transform: 'rotate(0) translateY(0)' },
    { transform: 'rotate(-10deg) translateY(-4px)', offset: 0.25 },
    { transform: 'rotate(8deg) translateY(2px)', offset: 0.55 },
    { transform: 'rotate(-4deg) translateY(-2px)', offset: 0.8 },
    { transform: 'rotate(0) translateY(0)' },
  ] },
  dash: { duration: 900, easing: 'ease-out', frames: [
    { transform: 'perspective(200px) rotateY(0) translateY(0)' },
    { transform: 'perspective(200px) rotateY(180deg) translateY(-18px)', offset: 0.45 },
    { transform: 'perspective(200px) rotateY(360deg) translateY(0) scale(1.1,0.9)', offset: 0.8 },
    { transform: 'perspective(200px) rotateY(360deg) scale(1)' },
  ] },
  tourism: { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0)', transformOrigin: '50% 0%' },
    { transform: 'rotate(16deg)', transformOrigin: '50% 0%', offset: 0.25 },
    { transform: 'rotate(-12deg)', transformOrigin: '50% 0%', offset: 0.5 },
    { transform: 'rotate(6deg)', transformOrigin: '50% 0%', offset: 0.75 },
    { transform: 'rotate(0)', transformOrigin: '50% 0%' },
  ] },
  study: { duration: 1000, easing: 'ease-out', frames: [
    { transform: 'translateY(0) rotate(0)' },
    { transform: 'translateY(-44px) rotate(200deg)', offset: 0.45 },
    { transform: 'translateY(0) rotate(360deg) scale(1.1,0.9)', offset: 0.8 },
    { transform: 'translateY(0) rotate(360deg) scale(1)' },
  ] },
  events: { duration: 1000, easing: 'ease-out', puff: '🎉', frames: [
    { transform: 'rotate(0) scale(1)' },
    { transform: 'rotate(-18deg) scale(1.2) translateY(-6px)', offset: 0.3 },
    { transform: 'rotate(10deg) scale(1.1)', offset: 0.6 },
    { transform: 'rotate(0) scale(1)' },
  ] },
  charity: { duration: 1000, easing: 'ease-out', puff: '💚', frames: [
    { transform: 'scale(1)' },
    { transform: 'scale(1.25)', offset: 0.3 },
    { transform: 'scale(0.95)', offset: 0.55 },
    { transform: 'scale(1.1)', offset: 0.75 },
    { transform: 'scale(1)' },
  ] },
  taxlegal: { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0)' },
    { transform: 'rotate(-12deg)', offset: 0.25 },
    { transform: 'rotate(10deg)', offset: 0.6 },
    { transform: 'rotate(0)' },
  ] },
  career: { duration: 800, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0) scale(1)' },
    { transform: 'rotate(-12deg) scale(1.15)', offset: 0.2 },
    { transform: 'rotate(10deg) scale(1.15)', offset: 0.4 },
    { transform: 'rotate(-6deg) scale(1.1)', offset: 0.6 },
    { transform: 'rotate(0) scale(1)' },
  ] },
  // Air charters: the helicopter lifts off and hovers, the seaplane touches down, the air ambulance flashes
  helicopter: { duration: 1200, easing: 'ease-in-out', puff: '💨', frames: [
    { transform: 'translateY(0) rotate(0)' },
    { transform: 'translateY(-18px) rotate(-8deg)', offset: 0.3 },
    { transform: 'translateY(-14px) rotate(6deg)', offset: 0.5 },
    { transform: 'translateY(-18px) rotate(-4deg)', offset: 0.7 },
    { transform: 'translateY(0) rotate(0)' },
  ] },
  seaplane: { duration: 1200, easing: 'ease-in-out', puff: '🌊', frames: [
    { transform: 'translate(0,0) rotate(0)' },
    { transform: 'translate(-20px,-22px) rotate(-14deg)', offset: 0.3 },
    { transform: 'translate(10px,6px) rotate(6deg)', offset: 0.65 },
    { transform: 'translate(0,0) rotate(0)' },
  ] },
  airambulance: { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'translateY(0)', filter: 'none' },
    { transform: 'translateY(-10px)', filter: 'drop-shadow(0 0 8px rgb(239 68 68))', offset: 0.25 },
    { transform: 'translateY(-10px)', filter: 'drop-shadow(0 0 8px rgb(59 130 246))', offset: 0.5 },
    { transform: 'translateY(-10px)', filter: 'drop-shadow(0 0 8px rgb(239 68 68))', offset: 0.75 },
    { transform: 'translateY(0)', filter: 'none' },
  ] },
  // Rides
  taxi: { duration: 900, easing: 'ease-out', frames: [
    { transform: 'translateX(0) scale(1)', filter: 'none' },
    { transform: 'translateX(-4px) scale(1.1)', filter: 'drop-shadow(0 0 8px rgb(250 204 21))', offset: 0.2 },
    { transform: 'translateX(4px) scale(1.1)', offset: 0.35 },
    { transform: 'translateX(-2px) scale(1.05)', offset: 0.5 },
    { transform: 'translateX(0) scale(1)', filter: 'none' },
  ] },
  limo: { duration: 1100, easing: 'ease-in-out', puff: '✨', frames: [
    { transform: 'translateX(0) rotate(0)' },
    { transform: 'translateX(-10px) rotate(-10deg)', offset: 0.3 },
    { transform: 'translateX(10px) rotate(8deg)', offset: 0.65 },
    { transform: 'translateX(0) rotate(0)' },
  ] },
  ambulance: { duration: 1000, easing: 'linear', frames: [
    { transform: 'scale(1)', filter: 'none' },
    { transform: 'scale(1.15)', filter: 'drop-shadow(0 0 10px rgb(239 68 68))', offset: 0.2 },
    { transform: 'scale(1)', filter: 'drop-shadow(0 0 10px rgb(59 130 246))', offset: 0.4 },
    { transform: 'scale(1.15)', filter: 'drop-shadow(0 0 10px rgb(239 68 68))', offset: 0.6 },
    { transform: 'scale(1)', filter: 'drop-shadow(0 0 10px rgb(59 130 246))', offset: 0.8 },
    { transform: 'scale(1)', filter: 'none' },
  ] },
  motorcycle: { duration: 1000, easing: 'ease-out', puff: '💨', frames: [
    { transform: 'rotate(0)', transformOrigin: '80% 90%' },
    { transform: 'rotate(-22deg)', transformOrigin: '80% 90%', offset: 0.35 },
    { transform: 'rotate(-16deg)', transformOrigin: '80% 90%', offset: 0.6 },
    { transform: 'rotate(3deg)', transformOrigin: '80% 90%', offset: 0.85 },
    { transform: 'rotate(0)', transformOrigin: '80% 90%' },
  ] },
  bike: { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'translate(0,0)' },
    { transform: 'translate(4px,-3px) rotate(-3deg)', offset: 0.25 },
    { transform: 'translate(8px,0) rotate(0)', offset: 0.5 },
    { transform: 'translate(4px,-3px) rotate(-3deg)', offset: 0.75 },
    { transform: 'translate(0,0)' },
  ] },
  ebike: { duration: 800, easing: 'ease-out', puff: '⚡', frames: [
    { transform: 'scale(1) rotate(0)', filter: 'brightness(1)' },
    { transform: 'scale(1.3) rotate(-12deg)', filter: 'brightness(1.4) drop-shadow(0 0 10px rgb(250 204 21))', offset: 0.25 },
    { transform: 'scale(0.9) rotate(8deg)', offset: 0.5 },
    { transform: 'scale(1.1) rotate(-4deg)', offset: 0.75 },
    { transform: 'scale(1) rotate(0)', filter: 'brightness(1)' },
  ] },
  scooter: { duration: 1000, easing: 'ease-in-out', puff: '💨', frames: [
    { transform: 'translateX(0) rotate(0)' },
    { transform: 'translateX(-6px) rotate(4deg)', offset: 0.2 },
    { transform: 'translateX(16px) rotate(-6deg)', offset: 0.55 },
    { transform: 'translateX(0) rotate(0)' },
  ] },
  // Shipping
  food: { duration: 900, easing: 'ease-out', puff: '♨️', frames: [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-12px) scale(1.1)', offset: 0.3 },
    { transform: 'translateY(0) scale(1.12,0.88)', offset: 0.55 },
    { transform: 'translateY(0) scale(1)' },
  ] },
  truck: { duration: 1000, easing: 'linear', puff: '💨', frames: [
    { transform: 'translate(0,0)' },
    { transform: 'translate(-2px,-2px)', offset: 0.1 },
    { transform: 'translate(2px,0)', offset: 0.2 },
    { transform: 'translate(-2px,-2px)', offset: 0.3 },
    { transform: 'translate(14px,0)', offset: 0.6 },
    { transform: 'translate(0,0)' },
  ] },
  freight: { duration: 1200, easing: 'ease-in-out', puff: '🌊', frames: [
    { transform: 'translate(0,0) rotate(0)' },
    { transform: 'translate(-6px,-3px) rotate(-6deg)', offset: 0.3 },
    { transform: 'translate(6px,2px) rotate(5deg)', offset: 0.65 },
    { transform: 'translate(0,0) rotate(0)' },
  ] },
  // Tax & Legal
  tax: { duration: 900, easing: 'ease-out', frames: [
    { transform: 'scaleY(1) translateY(0)', transformOrigin: '50% 0%' },
    { transform: 'scaleY(0.4) translateY(0)', transformOrigin: '50% 0%', offset: 0.25 },
    { transform: 'scaleY(1.15) translateY(2px)', transformOrigin: '50% 0%', offset: 0.65 },
    { transform: 'scaleY(1) translateY(0)', transformOrigin: '50% 0%' },
  ] },
  legal: { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0) scale(1)' },
    { transform: 'rotate(-90deg) scale(0.8)', offset: 0.3 },
    { transform: 'rotate(10deg) scale(1.15)', offset: 0.65 },
    { transform: 'rotate(0) scale(1)' },
  ] },
  lawyer: { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'translateY(0) rotate(0)' },
    { transform: 'translateY(-8px) rotate(-6deg)', offset: 0.3 },
    { transform: 'translateY(2px) rotate(4deg) scale(1.08,0.94)', offset: 0.55 },
    { transform: 'translateY(-3px) rotate(0)', offset: 0.75 },
    { transform: 'translateY(0) rotate(0)' },
  ] },
  // Stay property types (Hotels reuses the Stay tile's motion below)
  'stay-homestays': { duration: 1000, easing: 'ease-out', puff: '💨', frames: [
    { transform: 'scale(1)' },
    { transform: 'scale(1.15) translateY(-6px)', offset: 0.35 },
    { transform: 'scale(0.95)', offset: 0.65 },
    { transform: 'scale(1)' },
  ] },
  'stay-resorts': { duration: 1200, easing: 'ease-in-out', puff: '🌊', frames: [
    { transform: 'rotate(0)', transformOrigin: '50% 100%' },
    { transform: 'rotate(-12deg)', transformOrigin: '50% 100%', offset: 0.3 },
    { transform: 'rotate(9deg)', transformOrigin: '50% 100%', offset: 0.6 },
    { transform: 'rotate(-3deg)', transformOrigin: '50% 100%', offset: 0.85 },
    { transform: 'rotate(0)', transformOrigin: '50% 100%' },
  ] },
  'stay-hostels': { duration: 900, easing: 'ease-out', frames: [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(4px) scale(1.15,0.8)', offset: 0.2 },
    { transform: 'translateY(-14px) scale(0.95,1.05)', offset: 0.5 },
    { transform: 'translateY(0) scale(1.05,0.95)', offset: 0.8 },
    { transform: 'translateY(0) scale(1)' },
  ] },
  'stay-apartments': { duration: 900, easing: 'ease-out', frames: [
    { transform: 'scaleY(0.3)', opacity: 0.4, transformOrigin: '50% 100%' },
    { transform: 'scaleY(1.15)', opacity: 1, transformOrigin: '50% 100%', offset: 0.6 },
    { transform: 'scaleY(1)', transformOrigin: '50% 100%' },
  ] },
  'stay-villas': { duration: 900, easing: 'ease-out', puff: '✨', frames: [
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.25)', filter: 'brightness(1.2)', offset: 0.35 },
    { transform: 'scale(0.95)', offset: 0.65 },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ] },
  'stay-guesthouses': { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0)', transformOrigin: '50% 100%' },
    { transform: 'rotate(-8deg)', transformOrigin: '50% 100%', offset: 0.25 },
    { transform: 'rotate(8deg)', transformOrigin: '50% 100%', offset: 0.5 },
    { transform: 'rotate(-4deg)', transformOrigin: '50% 100%', offset: 0.75 },
    { transform: 'rotate(0)', transformOrigin: '50% 100%' },
  ] },
  'stay-bnb': { duration: 1000, easing: 'ease-in-out', puff: '♨️', frames: [
    { transform: 'rotate(0) translateY(0)' },
    { transform: 'rotate(-14deg) translateY(-6px)', offset: 0.35 },
    { transform: 'rotate(6deg) translateY(0)', offset: 0.7 },
    { transform: 'rotate(0) translateY(0)' },
  ] },
  // Side panel and bottom bar shortcuts (AppNav.tsx)
  'nav-home': { duration: 800, easing: 'ease-out', frames: [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-8px) scale(1.1)', offset: 0.35 },
    { transform: 'translateY(0) scale(1.1,0.9)', offset: 0.65 },
    { transform: 'translateY(0) scale(1)' },
  ] },
  'nav-explore': { duration: 800, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0) scale(1)' },
    { transform: 'rotate(90deg) scale(0.85)', offset: 0.5 },
    { transform: 'rotate(180deg) scale(1)' },
  ] },
  'nav-trips': { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0)', transformOrigin: '50% 0%' },
    { transform: 'rotate(14deg)', transformOrigin: '50% 0%', offset: 0.25 },
    { transform: 'rotate(-10deg)', transformOrigin: '50% 0%', offset: 0.5 },
    { transform: 'rotate(5deg)', transformOrigin: '50% 0%', offset: 0.75 },
    { transform: 'rotate(0)', transformOrigin: '50% 0%' },
  ] },
  'nav-rewards': { duration: 900, easing: 'ease-out', puff: '✨', frames: [
    { transform: 'scale(1) rotate(0)' },
    { transform: 'scale(1.25) rotate(-10deg) translateY(-4px)', offset: 0.3 },
    { transform: 'scale(0.95) rotate(8deg)', offset: 0.6 },
    { transform: 'scale(1) rotate(0)' },
  ] },
  'nav-profile': { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'perspective(200px) rotateY(0)' },
    { transform: 'perspective(200px) rotateY(180deg) scale(1.1)', offset: 0.5 },
    { transform: 'perspective(200px) rotateY(360deg)' },
  ] },
  'nav-account': { duration: 800, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0)', transformOrigin: '50% 100%' },
    { transform: 'rotate(-12deg)', transformOrigin: '50% 100%', offset: 0.25 },
    { transform: 'rotate(10deg)', transformOrigin: '50% 100%', offset: 0.5 },
    { transform: 'rotate(-4deg)', transformOrigin: '50% 100%', offset: 0.75 },
    { transform: 'rotate(0)', transformOrigin: '50% 100%' },
  ] },
};
ICON_MOTION['stay-hotels'] = ICON_MOTION.hotels;

// restart = true replays even if the icon is mid-animation (clicks); hover lets it finish
export function playIconMotion(el: HTMLElement | null | undefined, id: string, restart = false) {
  const motion = ICON_MOTION[id];
  if (!el || !motion || typeof el.animate !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (el.getAnimations().length) {
    if (!restart) return;
    el.getAnimations().forEach(a => a.cancel());
  }
  el.animate(motion.frames, { duration: motion.duration, easing: motion.easing ?? 'ease' });
  if (motion.puff) {
    // Little particles (smoke, waves) drifting off the icon
    for (let i = 0; i < 3; i++) {
      const puff = document.createElement('span');
      puff.textContent = motion.puff;
      puff.setAttribute('aria-hidden', 'true');
      puff.className = 'pointer-events-none absolute left-1/2 top-1/2 text-lg';
      el.parentElement?.appendChild(puff);
      const dx = motion.puff === '💨' ? -30 - i * 10 : (i - 1) * 26;
      puff.animate([
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
        { opacity: 0.9, offset: 0.2 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${motion.puff === '🌊' ? -18 : 28}px)) scale(1.1)`, opacity: 0 },
      ], { duration: 900, delay: i * 180, easing: 'ease-out', fill: 'backwards' }).onfinish = () => puff.remove();
    }
  }
}
