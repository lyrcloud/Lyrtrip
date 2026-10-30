// The home page's open service tab, shared with the side panel and bottom bar so they can highlight it
// and switch it without a page load.
let current: string | null = null;
const listeners = new Set<() => void>();
const OPEN_EVENT = 'lyrtrip:open-tab';

export function setNavTab(tab: string | null) {
  current = tab;
  listeners.forEach(listener => listener());
}

export function getNavTab() {
  return current;
}

export function subscribeNavTab(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Ask the home page (already showing) to open a tab. */
export function requestNavTab(tab: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tab }));
}

export function onNavTabRequest(handler: (tab: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
