'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import LegalForm from '@/components/LegalForm';
import { legalCall, legalDraftFrom, LEGAL_ICON, LEGAL_STATUS_STYLE, type LegalDraft, type LegalOptions, type LegalRequest } from '@/lib/legal';
import { rememberReturnTo } from '@/lib/returnTo';

const card = 'bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5 sm:p-6';
const primary = 'px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition';
const small = 'px-3 py-1.5 bg-btn text-white rounded-lg text-xs font-semibold disabled:bg-gray-300';
const usd = (n: number) => `$${n.toFixed(2)}`;

// Tax, legal and lawyer requests made through Lyrtrip: fees to pay, details to fix, progress updates
export default function LegalRequestsPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<LegalRequest[] | null>(null);
  const [opts, setOpts] = useState<LegalOptions | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: LegalDraft } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => legalCall<{ requests: LegalRequest[] } & LegalOptions>({ action: 'requests.mine' })
    .then(({ requests, ...o }) => { setRows(requests); setOpts(o); })
    .catch(err => { setRows([]); setError(err instanceof Error ? err.message : 'Could not load your requests.'); }), []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const paySession = params.get('pay_session');
      if (params.get('checkout') === 'canceled') setNotice('Checkout was cancelled. You have not been charged.');
      if (paySession || params.get('checkout')) window.history.replaceState({}, '', '/legal/requests');
      if (paySession) {
        try {
          await legalCall({ action: 'pay.confirm', sessionId: paySession });
          setNotice('Paid. Lyrtrip is assigning your professional now and will email you their details.');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not confirm the payment.');
        }
      }
      await load();
    })();
  }, [user, load]);

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id); setError(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong'); }
    setBusy(null);
    load();
  };
  const pay = (r: LegalRequest) => act(r.id, async () => {
    const { url } = await legalCall<{ url: string }>({ action: 'pay', id: r.id });
    window.location.href = url;
  });
  const cancel = (r: LegalRequest) => act(r.id, async () => {
    if (!confirm(`Cancel your request: ${r.categoryLabel}?`)) return;
    await legalCall({ action: 'request.cancel', id: r.id });
  });
  const resend = () => editing && act(editing.id, async () => {
    await legalCall({ action: 'request.update', id: editing.id, ...editing.draft });
    setEditing(null);
    setNotice('Sent. Lyrtrip will check the details and email you the price.');
  });

  if (!loading && !user) {
    return (
      <div className="flex-1 bg-gray-50 py-16 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My tax & legal requests</h1>
        <p className="text-gray-600 mb-6 max-w-lg mx-auto">Ask for tax, legal or lawyer help from the Tax & Legal tab. Lyrtrip finds a licensed professional, tells you the fee and assigns them.</p>
        <Link href="/login" onClick={() => rememberReturnTo('/legal/requests')} className={primary}>Sign in</Link>
      </div>
    );
  }

  const pct = Math.round((opts?.serviceRate ?? 0.1) * 100);
  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My tax & legal requests</h1>
          <p className="text-gray-600 text-sm">Lyrtrip finds a licensed professional, quotes the fee (theirs plus a {pct}% service charge), and assigns them once you pay.</p>
        </div>
        {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">{notice}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        <div className={card}>
          {rows === null && <p className="text-sm text-gray-500">Loading…</p>}
          {rows?.length === 0 && <p className="text-sm text-gray-500">No requests yet. <Link href="/?tab=tax" className="text-brand-600 font-semibold">Get tax or legal help</Link></p>}
          <div className="divide-y divide-gray-100">
            {rows?.map(r => (
              <div key={r.id} className="py-4 first:pt-0 last:pb-0 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{LEGAL_ICON[r.service] ?? '⚖️'} {r.serviceLabel}: {r.categoryLabel}</p>
                    <p className="text-gray-600">{[r.region, r.jurisdiction].filter(Boolean).join(', ')} · {r.meeting} · {r.urgency}{r.deadline ? ` · deadline ${r.deadline}` : ''}</p>
                    <p className="text-xs text-gray-400 line-clamp-2">{r.description} · requested {new Date(r.createdAt).toLocaleDateString()}</p>
                    {r.quote && (
                      <p className="mt-1 text-gray-700">
                        {r.quote.direct
                          ? <>Professional&apos;s fee {usd(r.quote.amount)}, paid to them directly · Lyrtrip booking fee <span className="font-semibold">{usd(r.quote.total)}</span></>
                          : <>Fee {usd(r.quote.amount)} + Lyrtrip service {usd(r.quote.service)} = <span className="font-semibold">{usd(r.quote.total)}</span></>}
                        {r.quote.paidAt
                          ? <span className="text-emerald-700"> · paid {new Date(r.quote.paidAt).toLocaleDateString()}</span>
                          : r.status === 'quoted' && <span className="text-gray-500"> · pay by {new Date(r.quote.expiresAt).toLocaleString()}</span>}
                      </p>
                    )}
                    {r.quote?.details && <p className="text-gray-600">{r.quote.details}</p>}
                    {r.message && <p className="mt-1 text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-2">{r.message}</p>}
                  </div>
                  <div className="text-right space-y-1">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${LEGAL_STATUS_STYLE[r.status] ?? ''}`}>{r.statusLabel}</span>
                    {r.status === 'quoted' && r.quote && (
                      <button onClick={() => pay(r)} disabled={busy === r.id} className={`block ml-auto mt-1 ${small}`}>{busy === r.id ? 'Opening…' : r.quote.direct ? `Pay booking fee ${usd(r.quote.total)}` : `Pay ${usd(r.quote.total)}`}</button>
                    )}
                    {r.status === 'info_needed' && editing?.id !== r.id && (
                      <button onClick={() => setEditing({ id: r.id, draft: legalDraftFrom(r) })} className={`block ml-auto mt-1 ${small}`}>Update details</button>
                    )}
                    {['submitted', 'info_needed', 'quoted'].includes(r.status) && (
                      <button onClick={() => cancel(r)} className="block ml-auto text-xs text-gray-500 underline">Cancel</button>
                    )}
                  </div>
                </div>
                {editing?.id === r.id && opts && (
                  <div className="mt-4 space-y-3">
                    <LegalForm draft={editing.draft} setDraft={d => setEditing({ id: r.id, draft: d })} opts={opts} />
                    <div className="flex gap-2">
                      <button onClick={resend} disabled={busy === r.id} className={primary}>{busy === r.id ? 'Sending…' : 'Send updated details'}</button>
                      <button onClick={() => setEditing(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600">Close</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
