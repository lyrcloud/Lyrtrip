import { idTokenOrNull } from '@/lib/rewards';

// Booking updates on this device: Web Push in browsers, Firebase push in the Android app.
// The API sends them alongside each booking email (infra/lambda/notify.mjs).

const baseUrl = () => (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');

export interface NotifyPrefs { sms: boolean; push: boolean; devices: number; phone: string | null }
interface NotifyConfig { vapidPublicKey: string | null; fcm: boolean; sms: boolean }

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const idToken = action === 'config' ? null : await idTokenOrNull();
  const res = await fetch(`${baseUrl()}/api/notify/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(idToken && { idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

let config: Promise<NotifyConfig> | null = null;
const getConfig = () => (config ??= call<NotifyConfig>('config').catch(err => { config = null; throw err; }));

// Capacitor's push plugin, present only in an app build that has Firebase set up
interface PushPlugin {
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: string, cb: (v: { value?: string; error?: string; notification?: { data?: { url?: string } } }) => void): Promise<unknown>;
  createChannel?(c: { id: string; name: string; importance: number }): Promise<void>;
}
function nativePush(): PushPlugin | null {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean; Plugins?: Record<string, unknown> } }).Capacitor;
  if (!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.('PushNotifications')) return null;
  return cap.Plugins?.PushNotifications as PushPlugin;
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

/** 'native' (app with push), 'web', or null when this device can't get push */
export async function pushSupport(): Promise<'native' | 'web' | null> {
  if (typeof window === 'undefined') return null;
  const cfg = await getConfig().catch(() => null);
  if (nativePush()) return cfg?.fcm ? 'native' : null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null;
  return cfg?.vapidPublicKey ? 'web' : null;
}

export async function pushEnabledHere(): Promise<boolean> {
  if (nativePush()) return !!localStorageGet('lyrtrip_push_native');
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return !!(await reg?.pushManager.getSubscription());
}

function localStorageGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k: string, v: string | null) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } }

/** Asks for permission and links this device to the signed-in account. Throws with a message to show. */
export async function enablePush(): Promise<void> {
  const push = nativePush();
  if (push) {
    const { receive } = await push.requestPermissions();
    if (receive !== 'granted') throw new Error('Notifications are blocked for Lyrtrip in your phone settings.');
    await push.createChannel?.({ id: 'bookings', name: 'Booking updates', importance: 4 });
    const token = await new Promise<string>((resolve, reject) => {
      push.addListener('registration', v => resolve(v.value ?? ''));
      push.addListener('registrationError', v => reject(new Error(v.error ?? 'Could not register for notifications')));
      push.addListener('pushNotificationActionPerformed', v => { const url = v.notification?.data?.url; if (url) window.location.href = url; });
      push.register().catch(reject);
    });
    await call('subscribe', { kind: 'fcm', token });
    localStorageSet('lyrtrip_push_native', token);
    return;
  }
  const cfg = await getConfig();
  if (!cfg.vapidPublicKey) throw new Error('Notifications are not available yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for www.lyrtrip.com in your browser settings.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription()
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey) });
  await call('subscribe', { kind: 'web', subscription: subscription.toJSON() });
}

export async function disablePush(): Promise<void> {
  if (nativePush()) {
    const token = localStorageGet('lyrtrip_push_native');
    if (token) await call('unsubscribe', { kind: 'fcm', token }).catch(() => {});
    localStorageSet('lyrtrip_push_native', null);
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  await call('unsubscribe', { kind: 'web', subscription: subscription.toJSON() }).catch(() => {});
  await subscription.unsubscribe();
}

export const getNotifyPrefs = () => call<NotifyPrefs>('prefs');
export const setNotifyPrefs = (p: Partial<Pick<NotifyPrefs, 'sms' | 'push'>>) => call<NotifyPrefs>('prefs', p);
