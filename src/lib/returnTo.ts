const KEY = 'lyrtrip_return_to';

// Pages that need sign-in remember themselves, so the visitor comes back after logging in
export function rememberReturnTo(path: string) {
  try { sessionStorage.setItem(KEY, path); } catch { /* storage unavailable */ }
}

export function takeReturnTo(fallback = '/dashboard'): string {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && path.startsWith('/') && !path.startsWith('//') ? path : fallback;
  } catch {
    return fallback;
  }
}
