'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { rewardsCall } from '@/lib/rewards';

interface GiftCard {
  code: string;
  amount: number;
  balance: number;
  status: 'pending' | 'active' | 'disabled' | 'cancelled';
  recipient_email: string | null;
  recipient_name: string | null;
  sender_name: string | null;
  message: string | null;
  createdAt: string | null;
  sentAt: string | null;
}

interface Business {
  company: string;
  tax_id: string;
  country: string;
  address: string;
  phone: string;
  website: string;
  industry: string;
  travellers_per_year: string;
  status: 'pending' | 'approved' | 'rejected';
  fee_percent?: number;
  note?: string;
}

interface Summary {
  points: number;
  pointsValue: number;
  pointsLifetime: number;
  giftCardBalance: number;
  tier: string;
  nextTier: { name: string; pointsNeeded: number } | null;
  badges: { id: string; label: string; description: string; earned: boolean }[];
  stats: { bookings_paid: number; spent_cents: number; referral_orders: number; referral_points: number };
  referral: { code: string; link: string; percent: number; orders: number; points: number };
  history: { at: string; points: number; note: string }[];
  giftCards: GiftCard[];
  giftCardsReceived: GiftCard[];
  business: Business | null;
  rules: {
    pointsPerDollarSpent: number; pointsPerDollar: number; affiliatePercent: number; businessFeePercent: number;
    tiers: { name: string; points: number }[]; giftCardPresets: number[]; giftCardMin: number; giftCardMax: number;
  };
}

const TIER_STYLE: Record<string, string> = {
  Member: 'bg-gray-100 text-gray-800', Bronze: 'bg-amber-100 text-amber-900', Silver: 'bg-slate-200 text-slate-800',
  Gold: 'bg-yellow-100 text-yellow-800', Platinum: 'bg-indigo-100 text-indigo-800',
};
const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800', pending: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800', disabled: 'bg-gray-200 text-gray-700', cancelled: 'bg-gray-200 text-gray-700',
};
const usd = (n: number) => `$${n.toFixed(2)}`;
const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';
const card = 'bg-white rounded-xl border border-gray-200 p-5';
const primary = 'px-4 py-2 rounded-lg text-sm font-medium bg-btn text-white hover:bg-btn-hover disabled:opacity-50';

export default function RewardsPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gift, setGift] = useState({ amount: 50, custom: '', recipient_email: '', recipient_name: '', sender_name: '', message: '' });
  const [sendTo, setSendTo] = useState<Record<string, string>>({});
  const [biz, setBiz] = useState({ company: '', tax_id: '', country: '', address: '', phone: '', website: '', industry: '', travellers_per_year: '' });
  const [editBiz, setEditBiz] = useState(false);

  const load = useCallback(async () => {
    try {
      const summary = await rewardsCall<Summary>({ action: 'summary' });
      setData(summary);
      if (summary.business) setBiz(b => ({ ...b, ...Object.fromEntries(Object.keys(b).map(k => [k, (summary.business as unknown as Record<string, string>)[k] ?? ''])) }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your rewards');
    }
  }, []);

  useEffect(() => { if (user) void load(); }, [user, load]);

  const act = async (key: string, payload: Record<string, unknown>, done?: string) => {
    setBusy(key);
    setNotice(null);
    try {
      const res = await rewardsCall<{ url?: string }>(payload);
      if (res.url) { window.location.href = res.url; return true; }
      if (done) setNotice(done);
      await load();
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!loading && !user) {
    return (
      <div className="flex-1 bg-gray-50 py-16 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Lyrtrip Rewards</h1>
        <p className="text-gray-600 mb-6">Earn points on every flight and hotel, refer friends, send gift cards and open a business account.</p>
        <Link href="/login" className={primary}>Sign in to see your rewards</Link>
      </div>
    );
  }

  const amount = gift.custom ? Number(gift.custom) : gift.amount;
  const copy = (textToCopy: string) => navigator.clipboard?.writeText(textToCopy).then(() => setNotice('Copied.'));
  const tierProgress = data?.nextTier
    ? Math.min(100, Math.round(100 * data.pointsLifetime / (data.pointsLifetime + data.nextTier.pointsNeeded)))
    : 100;

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rewards &amp; gift cards</h1>
          <p className="text-sm text-gray-500">Points, tier, referrals, gift cards and business pricing for {user?.email}</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}
        {notice && <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 text-sm text-gray-800">{notice}</div>}
        {!data && !error && <p className="text-gray-500">Loading…</p>}

        {data && (
          <>
            {/* Balance and tier */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className={card}>
                <p className="text-xs uppercase tracking-wide text-gray-500">Points balance</p>
                <p className="text-3xl font-bold text-gray-900">{data.points.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Worth {usd(data.pointsValue)} on your next booking</p>
              </div>
              <div className={card}>
                <p className="text-xs uppercase tracking-wide text-gray-500">Gift card balance</p>
                <p className="text-3xl font-bold text-gray-900">{usd(data.giftCardBalance)}</p>
                <p className="text-sm text-gray-600">Enter a card&apos;s code at checkout</p>
              </div>
              <div className={card}>
                <p className="text-xs uppercase tracking-wide text-gray-500">Tier</p>
                <p className="mt-1"><span className={`px-3 py-1 rounded-full text-sm font-bold ${TIER_STYLE[data.tier] ?? TIER_STYLE.Member}`}>{data.tier}</span></p>
                <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden"><div className="h-full bg-btn" style={{ width: `${tierProgress}%` }} /></div>
                <p className="text-xs text-gray-600 mt-1">
                  {data.nextTier ? `${data.nextTier.pointsNeeded.toLocaleString()} more points to ${data.nextTier.name}` : 'Top tier reached'}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className={card}>
              <h2 className="font-semibold text-gray-900 mb-3">Badges</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.badges.map(b => (
                  <div key={b.id} className={`rounded-lg border p-3 ${b.earned ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 opacity-60'}`}>
                    <p className="font-medium text-sm text-gray-900">{b.earned ? '🏅 ' : ''}{b.label}</p>
                    <p className="text-xs text-gray-600">{b.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Affiliate */}
            <div className={card}>
              <h2 className="font-semibold text-gray-900">Refer and earn</h2>
              <p className="text-sm text-gray-600 mb-3">
                Share your link. When someone books a flight or hotel within 30 days of opening it, you earn {data.referral.percent}% of their booking in points
                once it&apos;s confirmed.
              </p>
              <div className="flex gap-2">
                <input readOnly value={data.referral.link} className={`${input} font-mono`} onFocus={e => e.target.select()} />
                <button onClick={() => copy(data.referral.link)} className={primary}>Copy</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Code {data.referral.code} · {data.referral.orders} referred booking{data.referral.orders !== 1 ? 's' : ''} · {data.referral.points.toLocaleString()} points earned
              </p>
            </div>

            {/* Gift cards */}
            <div className={card}>
              <h2 className="font-semibold text-gray-900">Buy a gift card</h2>
              <p className="text-sm text-gray-600 mb-3">Good for any Lyrtrip flight or hotel. Send it by email, or keep the code for yourself.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {data.rules.giftCardPresets.map(p => (
                  <button key={p} onClick={() => setGift({ ...gift, amount: p, custom: '' })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border ${!gift.custom && gift.amount === p ? 'bg-btn text-white border-btn' : 'bg-white border-gray-300 text-gray-700'}`}>
                    {usd(p)}
                  </button>
                ))}
                <input type="number" min={data.rules.giftCardMin} max={data.rules.giftCardMax} placeholder={`Other ($${data.rules.giftCardMin}–${data.rules.giftCardMax})`}
                  value={gift.custom} onChange={e => setGift({ ...gift, custom: e.target.value })} className={`${input} w-44`} />
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={input} type="email" placeholder="Recipient email (optional)" value={gift.recipient_email} onChange={e => setGift({ ...gift, recipient_email: e.target.value })} />
                <input className={input} placeholder="Recipient name" value={gift.recipient_name} onChange={e => setGift({ ...gift, recipient_name: e.target.value })} />
                <input className={input} placeholder="From (your name)" value={gift.sender_name} onChange={e => setGift({ ...gift, sender_name: e.target.value })} />
                <input className={input} placeholder="Message" maxLength={300} value={gift.message} onChange={e => setGift({ ...gift, message: e.target.value })} />
              </div>
              <button className={`${primary} mt-3`} disabled={busy === 'gift' || !(amount > 0)}
                onClick={() => act('gift', { action: 'giftcard.buy', ...gift, amount })}>
                {busy === 'gift' ? 'Opening checkout…' : `Pay ${amount > 0 ? usd(amount) : ''} →`}
              </button>

              {(data.giftCards.length > 0 || data.giftCardsReceived.length > 0) && (
                <div className="mt-5 divide-y divide-gray-100 border-t border-gray-100">
                  {[...data.giftCardsReceived.map(c => ({ ...c, received: true })), ...data.giftCards.map(c => ({ ...c, received: false }))].map(c => (
                    <div key={c.code} className="py-3 flex flex-wrap items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-mono font-semibold text-gray-900">{c.code}</p>
                        <p className="text-gray-600">
                          {usd(c.amount)} card · {usd(c.balance)} left
                          {c.received ? ` · from ${c.sender_name || 'a friend'}` : c.recipient_email ? ` · for ${c.recipient_email}${c.sentAt ? ' (sent)' : ''}` : ' · yours'}
                        </p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[c.status] ?? ''}`}>{c.status}</span>
                      </div>
                      {!c.received && c.status === 'active' && (
                        <div className="flex gap-2">
                          <input className={`${input} w-52`} type="email" placeholder="Send to email"
                            value={sendTo[c.code] ?? c.recipient_email ?? ''} onChange={e => setSendTo({ ...sendTo, [c.code]: e.target.value })} />
                          <button className={primary} disabled={busy === c.code}
                            onClick={() => act(c.code, { action: 'giftcard.send', code: c.code, recipient_email: sendTo[c.code] ?? c.recipient_email }, 'Gift card sent.')}>
                            {c.sentAt ? 'Resend' : 'Send'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Business account */}
            <div className={card}>
              <h2 className="font-semibold text-gray-900">Business account (B2B)</h2>
              {data.business && !editBiz ? (
                <div className="text-sm mt-2">
                  <p>
                    <span className="font-medium">{data.business.company}</span>{' '}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[data.business.status]}`}>{data.business.status}</span>
                  </p>
                  <p className="text-gray-600 mt-1">
                    {data.business.status === 'approved'
                      ? `Your bookings use the business service fee of ${data.business.fee_percent ?? data.rules.businessFeePercent}% instead of 12%. Sign in when you book.`
                      : data.business.status === 'pending'
                        ? 'We are reviewing your application and will email you.'
                        : 'This application was not approved.'}
                    {data.business.note ? ` Note: ${data.business.note}` : ''}
                  </p>
                  <button className="mt-2 text-brand-600 text-sm underline" onClick={() => setEditBiz(true)}>Update details</button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Companies that book travel for their teams pay a {data.rules.businessFeePercent}% service fee instead of 12% once approved.
                    Personal (B2C) bookings keep the standard price.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input className={input} placeholder="Company legal name *" value={biz.company} onChange={e => setBiz({ ...biz, company: e.target.value })} />
                    <input className={input} placeholder="Tax ID (EIN, VAT, GST) *" value={biz.tax_id} onChange={e => setBiz({ ...biz, tax_id: e.target.value })} />
                    <input className={input} placeholder="Country code, e.g. US *" maxLength={2} value={biz.country} onChange={e => setBiz({ ...biz, country: e.target.value.toUpperCase() })} />
                    <input className={input} placeholder="Phone" value={biz.phone} onChange={e => setBiz({ ...biz, phone: e.target.value })} />
                    <input className={`${input} sm:col-span-2`} placeholder="Business address *" value={biz.address} onChange={e => setBiz({ ...biz, address: e.target.value })} />
                    <input className={input} placeholder="Website" value={biz.website} onChange={e => setBiz({ ...biz, website: e.target.value })} />
                    <input className={input} placeholder="Industry" value={biz.industry} onChange={e => setBiz({ ...biz, industry: e.target.value })} />
                    <input className={input} placeholder="Travellers per year" value={biz.travellers_per_year} onChange={e => setBiz({ ...biz, travellers_per_year: e.target.value })} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className={primary} disabled={busy === 'biz'}
                      onClick={async () => { if (await act('biz', { action: 'business.apply', ...biz }, 'Application sent. We will email you once it is reviewed.')) setEditBiz(false); }}>
                      {busy === 'biz' ? 'Sending…' : 'Apply for a business account'}
                    </button>
                    {editBiz && <button className="px-4 py-2 text-sm text-gray-600" onClick={() => setEditBiz(false)}>Cancel</button>}
                  </div>
                </>
              )}
            </div>

            {/* History */}
            <div className={card}>
              <h2 className="font-semibold text-gray-900 mb-2">Points history</h2>
              {data.history.length === 0 ? <p className="text-sm text-gray-500">No points yet. Book a flight or hotel to start earning.</p> : (
                <div className="divide-y divide-gray-100 text-sm">
                  {data.history.map((h, i) => (
                    <div key={i} className="py-2 flex justify-between gap-3">
                      <div><p className="text-gray-900">{h.note}</p><p className="text-xs text-gray-400">{new Date(h.at).toLocaleString()}</p></div>
                      <span className={`font-semibold ${h.points >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{h.points >= 0 ? '+' : ''}{h.points.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rules */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                You earn {data.rules.pointsPerDollarSpent} point{data.rules.pointsPerDollarSpent !== 1 ? 's' : ''} per US dollar on confirmed bookings made while signed in.
                {' '}{data.rules.pointsPerDollar} points = $1 off. Points, coupons and gift cards work on bookings in US dollars, and at least $1.00 is always paid by card.
              </p>
              <p>Tiers by lifetime points: {data.rules.tiers.slice().reverse().map(t => `${t.name} ${t.points.toLocaleString()}`).join(' · ')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
