'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { disablePush, enablePush, getNotifyPrefs, pushEnabledHere, pushSupport, setNotifyPrefs, type NotifyPrefs } from '@/lib/notifications';

/**
 * Booking updates beyond email. `compact` is the one-line offer on a booking receipt;
 * the full card (dashboard) also has the text-message switch.
 */
export default function NotificationSettings({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { user } = useAuth();
  const [support, setSupport] = useState<'native' | 'web' | null | undefined>(undefined);
  const [here, setHere] = useState(false);
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushSupport().then(setSupport).catch(() => setSupport(null));
    pushEnabledHere().then(setHere).catch(() => {});
    if (!compact) getNotifyPrefs().then(setPrefs).catch(() => {});
  }, [compact]);

  const togglePush = async () => {
    setBusy(true);
    setError(null);
    try {
      if (here) await disablePush(); else await enablePush();
      setHere(!here);
      if (!here && prefs && !prefs.push) setPrefs(await setNotifyPrefs({ push: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSms = async () => {
    if (!prefs) return;
    setBusy(true);
    setError(null);
    try {
      setPrefs(await setNotifyPrefs({ sms: !prefs.sms }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    if (!user || !support || here) return null;
    return (
      <div className={`rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm print:hidden ${className}`}>
        <p className="font-semibold text-gray-900">🔔 Get live updates on this device</p>
        <p className="text-gray-600 mt-0.5">We&apos;ll notify you when your booking is confirmed, changes or is on its way.</p>
        <button onClick={togglePush} disabled={busy} className="mt-3 rounded-lg bg-btn px-4 py-2 font-semibold text-white hover:bg-btn-hover disabled:bg-gray-300">
          {busy ? 'Turning on…' : 'Turn on notifications'}
        </button>
        {error && <p className="text-red-700 mt-2">{error}</p>}
      </div>
    );
  }

  const row = 'flex items-center justify-between gap-3 py-2.5';
  const switchCls = (on: boolean) => `relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-btn' : 'bg-slate-300'} disabled:opacity-50`;
  const knob = (on: boolean) => `absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`;

  return (
    <div>
      <div className="divide-y divide-slate-100">
        <div className={row}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Email</p>
            <p className="text-xs text-slate-500">Confirmations, receipts and every status change</p>
          </div>
          <span className="text-xs font-semibold text-emerald-700">Always on</span>
        </div>
        <div className={row}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Push on this device</p>
            <p className="text-xs text-slate-500">
              {support === undefined ? 'Checking…' : support ? 'Instant alerts for bookings, tracking and check-in' : 'Not available in this browser'}
            </p>
          </div>
          <button type="button" role="switch" aria-checked={here} aria-label="Push notifications on this device"
            onClick={togglePush} disabled={busy || !support} className={switchCls(here)}>
            <span className={knob(here)} />
          </button>
        </div>
        <div className={row}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Text messages</p>
            <p className="text-xs text-slate-500">To the phone number on each booking</p>
          </div>
          <button type="button" role="switch" aria-checked={!!prefs?.sms} aria-label="Text messages"
            onClick={toggleSms} disabled={busy || !prefs} className={switchCls(!!prefs?.sms)}>
            <span className={knob(!!prefs?.sms)} />
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
