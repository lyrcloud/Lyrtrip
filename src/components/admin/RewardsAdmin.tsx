'use client';

import React, { useCallback, useEffect, useState } from 'react';

// The admin console's rewards tabs, as on Lyrshop: everyone with admin access can look; only the super admin
// changes points, coupons, gift cards, business accounts and program settings.

type Call = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface RewardsAccount {
  sub: string;
  email: string;
  name: string;
  points_balance: number;
  points_lifetime: number;
  bookings_paid: number;
  spent_cents: number;
  referral_orders: number;
  referral_points: number;
  gift_cards_sent: number;
  tier: string;
  badges: string[];
  referralCode: string | null;
  note: string;
  business: {
    company: string; tax_id: string; country: string; address: string; phone: string; website: string; industry: string;
    travellers_per_year?: string; status: 'pending' | 'approved' | 'rejected'; fee_percent?: number; note?: string;
    appliedAt?: string; reviewedAt?: string; reviewedBy?: string;
  } | null;
}

export interface RewardsSettings { pointsPerDollarSpent: number; affiliatePercent: number; businessFeePercent: number }

interface Coupon {
  code: string; type: 'percent' | 'fixed'; value: number; min_total: number; max_uses: number; uses?: number; usedBy?: number;
  once_per_customer: boolean; expires: string; applies_to: 'all' | 'flight' | 'hotel' | 'shipping' | 'delivery'; active: boolean; description: string;
}

interface GiftCard {
  code: string; amount: number; balance: number; status: string; recipient_email: string | null; sender_name: string | null;
  createdAt: string | null; sentAt: string | null; source: string | null; buyerEmail: string | null; issuedBy: string | null; deliveryError: string | null;
}

export const TIER_STYLE: Record<string, string> = {
  Member: 'bg-gray-100 text-gray-700', Bronze: 'bg-amber-100 text-amber-900', Silver: 'bg-slate-200 text-slate-800',
  Gold: 'bg-yellow-100 text-yellow-800', Platinum: 'bg-indigo-100 text-indigo-800',
};
const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800', approved: 'bg-emerald-100 text-emerald-800', pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800', disabled: 'bg-gray-200 text-gray-700', cancelled: 'bg-gray-200 text-gray-700',
};

const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';
const smallBtn = 'px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const dangerBtn = 'px-2.5 py-1 rounded-md text-xs font-medium border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50';
const primary = 'px-3 py-2 rounded-lg text-sm font-medium bg-btn text-white hover:bg-btn-hover disabled:opacity-50';
const panel = 'bg-white rounded-xl border border-gray-200';
const usd = (n: number) => `$${Number(n).toFixed(2)}`;
const superOnly = <p className="text-xs text-gray-500">Only the super admin can make changes here.</p>;

function useAction(call: Call, reload: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const run = async (key: string, payload: Record<string, unknown>, done?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const res = await call(payload);
      await reload();
      if (done) setMessage({ text: done });
      return res;
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Action failed', error: true });
      return null;
    } finally {
      setBusy(null);
    }
  };
  const banner = message && (
    <div className={`rounded-lg p-3 text-sm ${message.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>{message.text}</div>
  );
  return { busy, run, banner };
}

// ── Points and tiers per user ────────────────────────────────────────────────

interface AdminUserLite { sub: string; email: string; name: string }

export function RewardsPanel({ call, isSuper, users, accounts, reload }: {
  call: Call; isSuper: boolean; users: AdminUserLite[]; accounts: RewardsAccount[]; reload: () => Promise<void>;
}) {
  const { busy, run, banner } = useAction(call, reload);
  const [query, setQuery] = useState('');
  const [adjust, setAdjust] = useState<Record<string, { points: string; note: string }>>({});
  const bySub = new Map(accounts.map(a => [a.sub, a]));
  // Every Cognito user, with their rewards account when they have one
  const rows = users.map(u => ({ user: u, a: bySub.get(u.sub) }))
    .concat(accounts.filter(a => !users.some(u => u.sub === a.sub)).map(a => ({ user: { sub: a.sub, email: a.email, name: a.name }, a })));
  const q = query.trim().toLowerCase();
  const shown = rows.filter(r => !q || `${r.user.email} ${r.user.name} ${r.a?.tier ?? ''}`.toLowerCase().includes(q))
    .sort((x, y) => (y.a?.points_lifetime ?? 0) - (x.a?.points_lifetime ?? 0));
  const totalPoints = accounts.reduce((s, a) => s + Math.max(0, a.points_balance), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Members with points', accounts.filter(a => a.points_lifetime > 0).length.toString()],
          ['Points outstanding', `${totalPoints.toLocaleString()} (${usd(totalPoints / 100)})`],
          ['Business accounts', accounts.filter(a => a.business?.status === 'approved').length.toString()],
          ['Referred bookings', accounts.reduce((s, a) => s + a.referral_orders, 0).toString()],
        ].map(([label, value]) => (
          <div key={label} className={`${panel} p-3`}><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-bold text-gray-900">{value}</p></div>
        ))}
      </div>
      {banner}
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by email, name or tier" className={input} />
      {!isSuper && superOnly}
      <div className={`${panel} divide-y divide-gray-100`}>
        {shown.length === 0 && <p className="p-4 text-sm text-gray-500">No users found.</p>}
        {shown.map(({ user, a }) => {
          const draft = adjust[user.sub] ?? { points: '', note: '' };
          return (
            <div key={user.sub} className="p-4 flex flex-wrap items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 break-all">{user.email || user.name || user.sub}</p>
                <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${TIER_STYLE[a?.tier ?? 'Member']}`}>{a?.tier ?? 'Member'}</span>
                  <span className={`px-2 py-0.5 rounded-full ${a?.business?.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                    {a?.business?.status === 'approved' ? `B2B · ${a.business.company}` : 'B2C'}
                  </span>
                  {(a?.badges ?? []).map(b => <span key={b} className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">{b}</span>)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {(a?.points_balance ?? 0).toLocaleString()} points ({usd((a?.points_balance ?? 0) / 100)}) · {(a?.points_lifetime ?? 0).toLocaleString()} lifetime ·{' '}
                  {a?.bookings_paid ?? 0} bookings · {usd((a?.spent_cents ?? 0) / 100)} booked
                </p>
              </div>
              {isSuper && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <input className={`${input} w-28`} type="number" placeholder="± points" value={draft.points}
                    onChange={e => setAdjust({ ...adjust, [user.sub]: { ...draft, points: e.target.value } })} />
                  <input className={`${input} w-44`} placeholder="Reason" value={draft.note}
                    onChange={e => setAdjust({ ...adjust, [user.sub]: { ...draft, note: e.target.value } })} />
                  <button className={smallBtn} disabled={busy !== null || !Number(draft.points)}
                    onClick={async () => {
                      if (await run(user.sub, { action: 'rewards.adjust', sub: user.sub, email: user.email, name: user.name, points: Number(draft.points), note: draft.note },
                        `${Number(draft.points) > 0 ? 'Added' : 'Removed'} ${Math.abs(Number(draft.points)).toLocaleString()} points for ${user.email}.`)) {
                        setAdjust({ ...adjust, [user.sub]: { points: '', note: '' } });
                      }
                    }}>
                    {busy === user.sub ? 'Saving…' : 'Adjust'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Affiliates ───────────────────────────────────────────────────────────────

export function AffiliatesPanel({ accounts, settings }: { accounts: RewardsAccount[]; settings: RewardsSettings | null }) {
  const affiliates = accounts.filter(a => a.referralCode).sort((x, y) => y.referral_orders - x.referral_orders || y.referral_points - x.referral_points);
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Every member gets a referral link (www.lyrtrip.com/?ref=CODE) on their Rewards page. They earn {settings?.affiliatePercent ?? 5}% of a referred
        booking in points once it&apos;s confirmed. Change the rate under Settings.
      </p>
      <div className={`${panel} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 border-b border-gray-200">
            <tr><th className="p-3">Affiliate</th><th className="p-3">Code</th><th className="p-3">Referred bookings</th><th className="p-3">Commission (points)</th><th className="p-3">Tier</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {affiliates.length === 0 && <tr><td colSpan={5} className="p-4 text-gray-500">No referral links yet. Members get one when they open their Rewards page.</td></tr>}
            {affiliates.map(a => (
              <tr key={a.sub}>
                <td className="p-3 break-all">{a.email || a.name}</td>
                <td className="p-3 font-mono">{a.referralCode}</td>
                <td className="p-3">{a.referral_orders}</td>
                <td className="p-3">{a.referral_points.toLocaleString()} ({usd(a.referral_points / 100)})</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TIER_STYLE[a.tier]}`}>{a.tier}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Business (B2B) accounts ──────────────────────────────────────────────────

export function BusinessPanel({ call, isSuper, accounts, settings, reload }: {
  call: Call; isSuper: boolean; accounts: RewardsAccount[]; settings: RewardsSettings | null; reload: () => Promise<void>;
}) {
  const { busy, run, banner } = useAction(call, reload);
  const [filter, setFilter] = useState<'' | 'pending' | 'approved' | 'rejected'>('pending');
  const [review, setReview] = useState<Record<string, { fee: string; note: string }>>({});
  const apps = accounts.filter(a => a.business && (!filter || a.business.status === filter))
    .sort((x, y) => String(y.business?.appliedAt ?? '').localeCompare(String(x.business?.appliedAt ?? '')));

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Approved business accounts pay a {settings?.businessFeePercent ?? 6}% service fee instead of 12% (or a custom rate set here). Everyone else books at retail (B2C).
      </p>
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', ''] as const).map(f => (
          <button key={f || 'all'} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f ? 'bg-btn text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
            {f ? f[0].toUpperCase() + f.slice(1) : 'All'} ({accounts.filter(a => a.business && (!f || a.business.status === f)).length})
          </button>
        ))}
      </div>
      {banner}
      {!isSuper && superOnly}
      <div className="space-y-3">
        {apps.length === 0 && <p className={`${panel} p-4 text-sm text-gray-500`}>No applications here.</p>}
        {apps.map(a => {
          const b = a.business!;
          const draft = review[a.sub] ?? { fee: b.fee_percent != null ? String(b.fee_percent) : '', note: b.note ?? '' };
          const set = (patch: Partial<typeof draft>) => setReview({ ...review, [a.sub]: { ...draft, ...patch } });
          return (
            <div key={a.sub} className={`${panel} p-4 text-sm`}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{b.company} <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[b.status]}`}>{b.status}</span></p>
                  <p className="text-gray-600 break-all">{a.email}</p>
                </div>
                {b.appliedAt && <p className="text-xs text-gray-400">Applied {new Date(b.appliedAt).toLocaleDateString()}</p>}
              </div>
              <dl className="grid sm:grid-cols-3 gap-x-4 gap-y-1 mt-2 text-xs">
                {([['Tax ID', b.tax_id], ['Country', b.country], ['Phone', b.phone], ['Address', b.address], ['Website', b.website], ['Industry', b.industry], ['Travellers / year', b.travellers_per_year]] as const)
                  .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-gray-500">{k}</dt><dd className="text-gray-900 break-all">{v}</dd></div>)}
              </dl>
              {b.reviewedBy && <p className="text-xs text-gray-400 mt-2">Reviewed by {b.reviewedBy}{b.reviewedAt ? ` on ${new Date(b.reviewedAt).toLocaleDateString()}` : ''}</p>}
              {isSuper && (
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  <input className={`${input} w-40`} type="number" min={0} max={12} step="0.5" placeholder={`Fee % (default ${settings?.businessFeePercent ?? 6})`}
                    value={draft.fee} onChange={e => set({ fee: e.target.value })} />
                  <input className={`${input} flex-1 min-w-[160px]`} placeholder="Note to the applicant (optional)" value={draft.note} onChange={e => set({ note: e.target.value })} />
                  <button className={primary} disabled={busy !== null}
                    onClick={() => run(a.sub, { action: 'business.review', sub: a.sub, status: 'approved', feePercent: draft.fee, note: draft.note }, `${b.company} is approved.`)}>
                    {b.status === 'approved' ? 'Save' : 'Approve'}
                  </button>
                  {b.status !== 'rejected' && (
                    <button className={dangerBtn} disabled={busy !== null}
                      onClick={() => run(a.sub, { action: 'business.review', sub: a.sub, status: 'rejected', feePercent: draft.fee, note: draft.note }, `${b.company} was rejected.`)}>
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Coupons ──────────────────────────────────────────────────────────────────

const EMPTY_COUPON: Coupon = {
  code: '', type: 'percent', value: 10, min_total: 0, max_uses: 0, once_per_customer: false, expires: '', applies_to: 'all', active: true, description: '',
};

export function CouponsPanel({ call, isSuper }: { call: Call; isSuper: boolean }) {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [draft, setDraft] = useState<Coupon>(EMPTY_COUPON);
  const [editCode, setEditCode] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await call({ action: 'coupons.list' });
      setCoupons(data.coupons as Coupon[]);
    } catch {
      setCoupons([]);
    }
  }, [call]);
  const { busy, run, banner } = useAction(call, load);
  useEffect(() => {
    call({ action: 'coupons.list' }).then(d => setCoupons(d.coupons as Coupon[])).catch(() => setCoupons([]));
  }, [call]);

  const today = new Date().toISOString().slice(0, 10);
  const state = (c: Coupon) => !c.active ? 'Off' : c.expires && c.expires < today ? 'Expired' : c.max_uses && (c.uses ?? 0) >= c.max_uses ? 'Used up' : 'Active';
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run('save', { action: 'coupons.save', coupon: draft, editCode }, editCode ? `${editCode} saved.` : `${draft.code.toUpperCase()} created.`);
    if (ok) { setDraft(EMPTY_COUPON); setEditCode(null); }
  };

  return (
    <div className="space-y-4">
      {banner}
      {isSuper ? (
        <form onSubmit={save} className={`${panel} p-4 grid sm:grid-cols-3 gap-3 text-sm`}>
          <label className="space-y-1"><span className="text-xs text-gray-600">Code</span>
            <input className={`${input} uppercase`} required disabled={!!editCode} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="SUMMER10" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-600">Type</span>
            <select className={input} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Coupon['type'] })}>
              <option value="percent">Percent off</option><option value="fixed">Amount off ($)</option>
            </select></label>
          <label className="space-y-1"><span className="text-xs text-gray-600">{draft.type === 'percent' ? 'Percent off (1–90)' : 'Amount off ($)'}</span>
            <input className={input} type="number" step="0.01" required value={draft.value} onChange={e => setDraft({ ...draft, value: Number(e.target.value) })} /></label>
          <label className="space-y-1"><span className="text-xs text-gray-600">Minimum booking ($)</span>
            <input className={input} type="number" step="0.01" min={0} value={draft.min_total || ''} onChange={e => setDraft({ ...draft, min_total: Number(e.target.value) })} /></label>
          <label className="space-y-1"><span className="text-xs text-gray-600">Usage limit (0 = unlimited)</span>
            <input className={input} type="number" min={0} value={draft.max_uses} onChange={e => setDraft({ ...draft, max_uses: Number(e.target.value) })} /></label>
          <label className="space-y-1"><span className="text-xs text-gray-600">Expires</span>
            <input className={input} type="date" value={draft.expires} onChange={e => setDraft({ ...draft, expires: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-xs text-gray-600">Works on</span>
            <select className={input} value={draft.applies_to} onChange={e => setDraft({ ...draft, applies_to: e.target.value as Coupon['applies_to'] })}>
              <option value="all">Everything</option><option value="flight">Flights only</option><option value="hotel">Hotels only</option><option value="shipping">Shipping only</option><option value="delivery">Courier deliveries only</option>
            </select></label>
          <label className="space-y-1 sm:col-span-2"><span className="text-xs text-gray-600">Description (internal)</span>
            <input className={input} maxLength={120} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
          <div className="sm:col-span-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.once_per_customer} onChange={e => setDraft({ ...draft, once_per_customer: e.target.checked })} /> Once per customer (needs sign-in)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
            <button type="submit" className={primary} disabled={busy !== null}>{busy === 'save' ? 'Saving…' : editCode ? 'Save coupon' : 'Create coupon'}</button>
            {editCode && <button type="button" className={smallBtn} onClick={() => { setEditCode(null); setDraft(EMPTY_COUPON); }}>Cancel edit</button>}
          </div>
        </form>
      ) : superOnly}

      <div className={`${panel} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 border-b border-gray-200">
            <tr><th className="p-3">Code</th><th className="p-3">Discount</th><th className="p-3">Rules</th><th className="p-3">Used</th><th className="p-3">Status</th>{isSuper && <th className="p-3" />}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {coupons === null && <tr><td colSpan={6} className="p-4 text-gray-500">Loading…</td></tr>}
            {coupons?.length === 0 && <tr><td colSpan={6} className="p-4 text-gray-500">No coupons yet.</td></tr>}
            {coupons?.map(c => (
              <tr key={c.code}>
                <td className="p-3"><span className="font-semibold font-mono">{c.code}</span>{c.description && <p className="text-xs text-gray-500">{c.description}</p>}</td>
                <td className="p-3">{c.type === 'percent' ? `${c.value}% off` : `${usd(c.value)} off`}</td>
                <td className="p-3 text-xs text-gray-600">
                  {[c.applies_to !== 'all' && `${{ flight: 'flights', hotel: 'hotels', shipping: 'shipping', delivery: 'courier deliveries' }[c.applies_to]} only`, c.min_total > 0 && `min ${usd(c.min_total)}`, c.once_per_customer && 'once per customer', c.expires && `until ${c.expires}`].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="p-3">{c.uses ?? 0}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${state(c) === 'Active' ? STATUS_STYLE.active : STATUS_STYLE.disabled}`}>{state(c)}</span></td>
                {isSuper && (
                  <td className="p-3 whitespace-nowrap space-x-1">
                    <button className={smallBtn} disabled={busy !== null} onClick={() => { setEditCode(c.code); setDraft({ ...EMPTY_COUPON, ...c }); }}>Edit</button>
                    <button className={smallBtn} disabled={busy !== null}
                      onClick={() => run(c.code, { action: 'coupons.save', editCode: c.code, coupon: { ...c, active: !c.active } }, `${c.code} turned ${c.active ? 'off' : 'on'}.`)}>
                      {c.active ? 'Turn off' : 'Turn on'}
                    </button>
                    <button className={dangerBtn} disabled={busy !== null}
                      onClick={() => window.confirm(`Delete coupon ${c.code}?`) && run(c.code, { action: 'coupons.delete', code: c.code }, `${c.code} deleted.`)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Gift cards ───────────────────────────────────────────────────────────────

export function GiftCardsPanel({ call, isSuper }: { call: Call; isSuper: boolean }) {
  const [cards, setCards] = useState<GiftCard[] | null>(null);
  const [draft, setDraft] = useState({ amount: '50', recipient_email: '', recipient_name: '', message: '' });
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    try {
      const data = await call({ action: 'giftcards.list' });
      setCards(data.giftCards as GiftCard[]);
    } catch {
      setCards([]);
    }
  }, [call]);
  const { busy, run, banner } = useAction(call, load);
  useEffect(() => {
    call({ action: 'giftcards.list' }).then(d => setCards(d.giftCards as GiftCard[])).catch(() => setCards([]));
  }, [call]);

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run('issue', { action: 'giftcards.issue', ...draft, amount: Number(draft.amount) });
    const card = res?.giftCard as GiftCard | undefined;
    if (card) {
      setDraft({ amount: '50', recipient_email: '', recipient_name: '', message: '' });
      window.alert(`Gift card ${card.code} issued for ${usd(card.amount)}.${res?.emailed === false ? ' The email could not be sent; share the code yourself.' : res?.emailed ? ` Emailed to ${card.recipient_email}.` : ''}`);
    }
  };
  const q = query.trim().toLowerCase();
  const shown = (cards ?? []).filter(c => !q || `${c.code} ${c.recipient_email ?? ''} ${c.buyerEmail ?? ''}`.toLowerCase().includes(q));
  const outstanding = (cards ?? []).filter(c => c.status === 'active').reduce((s, c) => s + c.balance, 0);

  return (
    <div className="space-y-4">
      {banner}
      {isSuper ? (
        <form onSubmit={issue} className={`${panel} p-4 grid sm:grid-cols-4 gap-3 text-sm`}>
          <p className="sm:col-span-4 text-gray-600">Issue a gift card from Lyrtrip (no payment): prizes, apologies, partners. It works straight away.</p>
          <input className={input} type="number" min={5} max={5000} step="0.01" required placeholder="Amount ($)" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} />
          <input className={input} type="email" placeholder="Email it to (optional)" value={draft.recipient_email} onChange={e => setDraft({ ...draft, recipient_email: e.target.value })} />
          <input className={input} placeholder="Recipient name" value={draft.recipient_name} onChange={e => setDraft({ ...draft, recipient_name: e.target.value })} />
          <input className={input} placeholder="Message" maxLength={300} value={draft.message} onChange={e => setDraft({ ...draft, message: e.target.value })} />
          <button type="submit" className={`${primary} sm:col-span-4 sm:justify-self-start`} disabled={busy !== null}>{busy === 'issue' ? 'Issuing…' : 'Issue gift card'}</button>
        </form>
      ) : superOnly}

      <div className="flex flex-wrap gap-3 items-center">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by code or email" className={`${input} flex-1 min-w-[200px]`} />
        <p className="text-sm text-gray-600">Outstanding balance: <span className="font-semibold">{usd(outstanding)}</span></p>
      </div>

      <div className={`${panel} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 border-b border-gray-200">
            <tr><th className="p-3">Code</th><th className="p-3">Amount / balance</th><th className="p-3">From → to</th><th className="p-3">Status</th>{isSuper && <th className="p-3" />}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cards === null && <tr><td colSpan={5} className="p-4 text-gray-500">Loading…</td></tr>}
            {cards !== null && shown.length === 0 && <tr><td colSpan={5} className="p-4 text-gray-500">No gift cards.</td></tr>}
            {shown.map(c => (
              <tr key={c.code}>
                <td className="p-3 font-mono">{c.code}<p className="text-xs text-gray-400 font-sans">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</p></td>
                <td className="p-3">{usd(c.amount)} / <span className="font-semibold">{usd(c.balance)}</span></td>
                <td className="p-3 text-xs text-gray-600 break-all">
                  {c.source === 'admin' ? `Issued by ${c.issuedBy ?? 'Lyrtrip'}` : `Bought by ${c.buyerEmail ?? '—'}`} → {c.recipient_email ?? 'buyer'}
                  {c.deliveryError && <p className="text-red-600">{c.deliveryError}</p>}
                </td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[c.status] ?? STATUS_STYLE.disabled}`}>{c.status}</span></td>
                {isSuper && (
                  <td className="p-3 whitespace-nowrap">
                    {['active', 'disabled'].includes(c.status) && (
                      <div className="flex gap-1 items-center">
                        <input className={`${input} w-24`} type="number" min={0} step="0.01" placeholder="Balance" value={balances[c.code] ?? ''}
                          onChange={e => setBalances({ ...balances, [c.code]: e.target.value })} />
                        <button className={smallBtn} disabled={busy !== null || balances[c.code] === undefined || balances[c.code] === ''}
                          onClick={() => run(c.code, { action: 'giftcards.update', code: c.code, balance: Number(balances[c.code]) }, `${c.code} balance set.`)}>Set</button>
                        <button className={c.status === 'active' ? dangerBtn : smallBtn} disabled={busy !== null}
                          onClick={() => run(c.code, { action: 'giftcards.update', code: c.code, status: c.status === 'active' ? 'disabled' : 'active' }, `${c.code} ${c.status === 'active' ? 'disabled' : 'turned back on'}.`)}>
                          {c.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Program settings ─────────────────────────────────────────────────────────

export function SettingsPanel({ call, isSuper, settings, tiers, reload }: {
  call: Call; isSuper: boolean; settings: RewardsSettings | null; tiers: { name: string; points: number }[]; reload: () => Promise<void>;
}) {
  const { busy, run, banner } = useAction(call, reload);
  const [draft, setDraft] = useState<RewardsSettings | null>(settings);
  useEffect(() => { setDraft(settings); }, [settings]);
  if (!draft) return <p className="text-gray-500">Loading…</p>;
  const field = (key: keyof RewardsSettings, label: string, help: string, max: number) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <input className={`${input} w-32`} type="number" min={0} max={max} step="0.5" disabled={!isSuper}
        value={draft[key]} onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })} />
      <span className="block text-xs text-gray-500">{help}</span>
    </label>
  );
  return (
    <div className={`${panel} p-5 space-y-4`}>
      {banner}
      {field('pointsPerDollarSpent', 'Points per dollar booked', 'What travellers earn on confirmed bookings. 100 points = $1 off.', 10)}
      {field('affiliatePercent', 'Affiliate commission (%)', 'Share of a referred booking paid to the affiliate, in points.', 10)}
      {field('businessFeePercent', 'Business service fee (%)', 'Default fee for approved business accounts (retail is 12%). You can set a custom rate per business.', 12)}
      <div>
        <p className="text-sm font-medium text-gray-800">Tiers (lifetime points)</p>
        <p className="text-xs text-gray-600">{tiers.slice().reverse().map(t => `${t.name} ${t.points.toLocaleString()}+`).join(' · ')}</p>
      </div>
      {isSuper ? (
        <button className={primary} disabled={busy !== null} onClick={() => run('settings', { action: 'settings.save', settings: draft }, 'Settings saved.')}>
          {busy === 'settings' ? 'Saving…' : 'Save settings'}
        </button>
      ) : superOnly}
    </div>
  );
}

// ── Shipments (Easyship labels) ──────────────────────────────────────────────

interface AdminShipment {
  orderId: string; status: string; courier: string; sender: string; totalPrice: number; amountPaid: number; baseCost: number;
  from: { city: string; country_alpha2: string }; to: { contact_name?: string; city: string; country_alpha2: string };
  easyshipId: string | null; tracking: { number: string }[]; trackingUrl: string | null; documents: { category: string; url: string }[];
  labelError: string | null; createdAt: string;
}

const SHIP_STATUS: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800', processing: 'bg-sky-100 text-sky-800', needs_review: 'bg-amber-100 text-amber-800',
  refunded: 'bg-gray-200 text-gray-700', label_failed: 'bg-red-100 text-red-800',
};

export function ShipmentsPanel({ call }: { call: Call }) {
  const [rows, setRows] = useState<AdminShipment[] | null>(null);
  useEffect(() => {
    call({ action: 'shipments.list' }).then(d => setRows(d.shipments as AdminShipment[])).catch(() => setRows([]));
  }, [call]);
  const confirmed = (rows ?? []).filter(r => r.status === 'confirmed');
  const margin = confirmed.reduce((s, r) => s + (r.totalPrice - r.baseCost), 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Labels bought', String(confirmed.length)],
          ['Need review', String((rows ?? []).filter(r => r.status === 'needs_review').length)],
          ['Sales', usd(confirmed.reduce((s, r) => s + r.totalPrice, 0))],
          ['Lyrtrip margin', usd(margin)],
        ].map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      <p className="text-xs text-gray-500">&quot;Need review&quot; means the payment went through but the label result is unknown: find the order number in Easyship, then send the label or refund in Stripe.</p>
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No shipments yet.</p>}
        {rows?.map(r => (
          <div key={r.orderId} className="p-4 flex flex-wrap items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                {r.from.city}, {r.from.country_alpha2} → {r.to.city}, {r.to.country_alpha2}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${SHIP_STATUS[r.status] ?? 'bg-gray-100 text-gray-700'}`}>{r.status.replace('_', ' ')}</span>
              </p>
              <p className="text-gray-600">{r.courier} · {r.sender}</p>
              <p className="text-xs text-gray-400">
                Order {r.orderId}{r.easyshipId ? ` · ${r.easyshipId}` : ''}{r.tracking[0] ? ` · ${r.tracking[0].number}` : ''} · {new Date(r.createdAt).toLocaleString()}
              </p>
              {r.labelError && <p className="text-xs text-red-600 mt-1">{r.labelError}</p>}
              <div className="flex gap-3 mt-1 text-xs">
                {r.documents.filter(d => d.category === 'label').map(d => <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 font-semibold">Label</a>)}
                {r.trackingUrl && <a href={r.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 font-semibold">Tracking</a>}
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">{usd(r.totalPrice)}</p>
              <p className="text-xs text-gray-500">cost {usd(r.baseCost)} · {r.amountPaid !== r.totalPrice ? `${usd(r.amountPaid)} by card` : 'card'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Courier deliveries (Uber Direct) ─────────────────────────────────────────

interface AdminDelivery {
  orderId: string; status: string; uberStatus: string | null; email: string; totalPrice: number; amountPaid: number; baseFee: number;
  currency: string; pickup: { label: string }; dropoff: { label: string }; item: { description: string };
  trackingUrl: string | null; uberDeliveryId: string | null; error: string | null; createdAt: string;
}

const DELIVERY_STATUS: Record<string, string> = {
  active: 'bg-sky-100 text-sky-800', delivered: 'bg-emerald-100 text-emerald-800', processing: 'bg-sky-100 text-sky-800',
  canceled: 'bg-gray-200 text-gray-700', returned: 'bg-amber-100 text-amber-800', refunded: 'bg-gray-200 text-gray-700', booking_failed: 'bg-red-100 text-red-800',
};

export function DeliveriesPanel({ call }: { call: Call }) {
  const [rows, setRows] = useState<AdminDelivery[] | null>(null);
  useEffect(() => {
    call({ action: 'deliveries.list' }).then(d => setRows(d.deliveries as AdminDelivery[])).catch(() => setRows([]));
  }, [call]);
  const booked = (rows ?? []).filter(r => ['active', 'delivered', 'returned'].includes(r.status));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Couriers booked', String(booked.length)],
          ['In progress', String((rows ?? []).filter(r => r.status === 'active').length)],
          ['Sales', usd(booked.reduce((s, r) => s + r.totalPrice, 0))],
          ['Lyrtrip margin', usd(booked.reduce((s, r) => s + r.totalPrice - r.baseFee, 0))],
        ].map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No courier deliveries yet.</p>}
        {rows?.map(r => (
          <div key={r.orderId} className="p-4 flex flex-wrap items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                {r.item.description}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${DELIVERY_STATUS[r.status] ?? 'bg-gray-100 text-gray-700'}`}>{r.uberStatus ?? r.status}</span>
              </p>
              <p className="text-gray-600 truncate">{r.pickup.label} → {r.dropoff.label}</p>
              <p className="text-xs text-gray-400">{r.email} · Order {r.orderId}{r.uberDeliveryId ? ` · ${r.uberDeliveryId}` : ''} · {new Date(r.createdAt).toLocaleString()}</p>
              {r.error && <p className="text-xs text-red-600 mt-1">{r.error}</p>}
              {r.trackingUrl && <a href={r.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 font-semibold">Tracking</a>}
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">{usd(r.totalPrice)}</p>
              <p className="text-xs text-gray-500">Uber fee {usd(r.baseFee)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Rides (Guest Rides) ──────────────────────────────────────────────────────

interface AdminRide {
  orderId: string; status: string; step: string | null; tier: string; email: string; riderName: string; riderPhone: string;
  currency: string; pickup: { label: string }; dropoff: { label: string }; estimatedTotal: number; holdAmount: number;
  totalCharged: number | null; bookedFare: number; finalFare: number | null; finalFareSource: string | null;
  uberTripId: string | null; trackingUrl: string | null; paymentIntent: string | null; error: string | null; createdAt: string;
}

const RIDE_STATUS: Record<string, string> = {
  active: 'bg-sky-100 text-sky-800', processing: 'bg-sky-100 text-sky-800', settling: 'bg-sky-100 text-sky-800', completed: 'bg-emerald-100 text-emerald-800',
  canceled: 'bg-gray-200 text-gray-700', not_booked: 'bg-gray-200 text-gray-700', needs_review: 'bg-red-100 text-red-800',
};

export function RidesPanel({ call }: { call: Call }) {
  const [rows, setRows] = useState<AdminRide[] | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    call({ action: 'rides.list' }).then(d => { setRows(d.rides as AdminRide[]); setEnabled(d.enabled as boolean); }).catch(() => setRows([]));
  }, [call]);
  const done = (rows ?? []).filter(r => r.status === 'completed');
  const money = (n: number, c = 'USD') => `${c} ${n.toFixed(2)}`;
  return (
    <div className="space-y-3">
      {enabled === false && (
        <p className={`${panel} p-3 text-sm text-amber-800 bg-amber-50`}>Ride booking is switched off (RIDES_ENABLED is not true). Travellers see estimates only.</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Rides completed', String(done.length)],
          ['Live now', String((rows ?? []).filter(r => r.status === 'active').length)],
          ['Sales', usd(done.reduce((s, r) => s + (r.totalCharged ?? 0), 0))],
          ['Lyrtrip margin', usd(done.reduce((s, r) => s + (r.totalCharged ?? 0) - (r.finalFare ?? r.bookedFare), 0))],
        ].map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No rides yet.</p>}
        {rows?.map(r => (
          <div key={r.orderId} className="p-4 flex flex-wrap items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                {r.tier} · {r.riderName}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${RIDE_STATUS[r.status] ?? 'bg-gray-100 text-gray-700'}`}>{r.status === 'active' ? r.step : r.status.replace('_', ' ')}</span>
              </p>
              <p className="text-gray-600 truncate">{r.pickup.label} → {r.dropoff.label}</p>
              <p className="text-xs text-gray-400">{r.email} · {r.riderPhone} · Order {r.orderId}{r.uberTripId ? ` · Trip ${r.uberTripId}` : ''}{r.paymentIntent ? ` · ${r.paymentIntent}` : ''} · {new Date(r.createdAt).toLocaleString()}</p>
              {r.error && <p className="text-xs text-red-600 mt-1">{r.error}</p>}
              {r.trackingUrl && <a href={r.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 font-semibold">Tracking</a>}
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">{r.totalCharged != null ? money(r.totalCharged, r.currency) : `est. ${money(r.estimatedTotal, r.currency)}`}</p>
              <p className="text-xs text-gray-500">Fare {money(r.finalFare ?? r.bookedFare, r.currency)}{r.finalFareSource === 'booked_fare' ? ' (upfront)' : ''} · hold {money(r.holdAmount, r.currency)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Job profiles (talent directory subscriptions) ─────────────────────────────

interface AdminJobProfile {
  id: string; name: string; email: string; headline: string; city: string; country: string; photoUrl: string | null;
  missing: number; hidden: boolean; listed: boolean; companyViews: number; updatedAt: string;
  subscription: { plan: string; period: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
}

export function JobProfilesPanel({ call }: { call: Call }) {
  const [rows, setRows] = useState<AdminJobProfile[] | null>(null);
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const load = useCallback(() => {
    call({ action: 'jobprofiles.list' })
      .then(d => { setRows(d.profiles as AdminJobProfile[]); setPrices(d.prices as Record<string, Record<string, number>>); })
      .catch(() => setRows([]));
  }, [call]);
  useEffect(() => { load(); }, [load]);
  const hide = async (r: AdminJobProfile) => {
    if (!r.hidden && !confirm(`Hide ${r.name || r.email} from the talent directory? Their plan keeps running.`)) return;
    await call({ action: 'jobprofiles.hide', id: r.id, hidden: !r.hidden });
    load();
  };
  const paying = (rows ?? []).filter(r => r.subscription && ['active', 'trialing', 'past_due'].includes(r.subscription.status));
  // Recurring revenue, as a monthly figure
  const perMonth: Record<string, number> = { week: 52 / 12, month: 1, month3: 1 / 3, month6: 1 / 6, year: 1 / 12 };
  const mrr = paying.filter(r => !r.subscription!.cancelAtPeriodEnd)
    .reduce((s, r) => s + (prices[r.subscription!.period]?.[r.subscription!.plan] ?? 0) * (perMonth[r.subscription!.period] ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Profiles', String(rows?.length ?? 0)],
          ['Listed now', String((rows ?? []).filter(r => r.listed).length)],
          ['Paying', String(paying.length)],
          ['Monthly recurring', usd(mrr)],
        ].map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No job profiles yet.</p>}
        {rows?.map(r => (
          <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3 min-w-0">
              {r.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                : <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">🧑</span>}
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {r.name || '(no name)'}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${r.hidden ? 'bg-red-100 text-red-800' : r.listed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                    {r.hidden ? 'hidden' : r.listed ? 'listed' : r.missing ? `${r.missing} fields missing` : 'not paid'}
                  </span>
                </p>
                <p className="text-gray-600 truncate">{r.headline}{r.city ? ` · ${r.city}, ${r.country}` : ''}</p>
                <p className="text-xs text-gray-400">{r.email} · {r.companyViews} company views · updated {new Date(r.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              {r.subscription
                ? <p className="text-gray-700">{r.subscription.plan} · {r.subscription.period} · {r.subscription.status}{r.subscription.cancelAtPeriodEnd ? ' (ending)' : ''}{r.subscription.currentPeriodEnd ? ` · to ${r.subscription.currentPeriodEnd.slice(0, 10)}` : ''}</p>
                : <p className="text-gray-400">No plan</p>}
              <div className="flex gap-3 justify-end">
                <a href={`/talent?id=${r.id}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 font-semibold">View</a>
                <button onClick={() => hide(r)} className="text-red-600 font-semibold">{r.hidden ? 'Unhide' : 'Hide'}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminJobApplication {
  id: string; sub: string; title: string; company: string; location: string; salary: string | null; jobType: string | null;
  status: string; statusLabel: string; message: string; createdAt: string; updatedAt: string;
  applicant: { name: string; email: string; phone: string; headline: string; city: string; country: string; yearsExperience: number | null; skills: string[]; cvName: string; cvUrl: string | null };
  coverLetter: string; via: string; applyOptions: { title: string; link: string }[]; shareLink: string | null; description: string; adminNote: string;
}

const JOB_APP_STEPS: [string, string][] = [
  ['submitted', 'Received'], ['forwarded', 'Sent to employer'], ['interview', 'Interview'], ['rejected', 'Not selected'], ['hired', 'Offer made'],
];

// Applications made through Lyrtrip: admins forward the CV to the employer and relay replies to the applicant
export function JobApplicationsPanel({ call }: { call: Call }) {
  const [rows, setRows] = useState<AdminJobApplication[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ status: string; message: string; note: string }>({ status: '', message: '', note: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    call({ action: 'jobapps.list' }).then(d => setRows(d.applications as AdminJobApplication[])).catch(() => setRows([]));
  }, [call]);
  useEffect(() => { load(); }, [load]);
  const expand = (a: AdminJobApplication) => {
    setOpen(open === a.id ? null : a.id);
    setDraft({ status: a.status === 'withdrawn' ? 'submitted' : a.status, message: '', note: a.adminNote });
  };
  const save = async (a: AdminJobApplication) => {
    setBusy(true);
    try {
      await call({ action: 'jobapps.update', id: a.id, status: draft.status, message: draft.message, note: draft.note });
      setOpen(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update the application');
    }
    setBusy(false);
  };
  const count = (s: string) => (rows ?? []).filter(r => r.status === s).length;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[['Applications', String(rows?.length ?? 0)], ['To forward', String(count('submitted'))], ['Sent to employer', String(count('forwarded'))], ['Interviews', String(count('interview'))]]
          .map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No job applications yet.</p>}
        {rows?.map(a => (
          <div key={a.id} className="p-4 text-sm">
            <button onClick={() => expand(a)} className="w-full flex flex-wrap items-start justify-between gap-2 text-left">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{a.applicant.name} <span className="font-normal text-gray-500">for</span> {a.title}</p>
                <p className="text-gray-600">{[a.company, a.location, a.via && `via ${a.via}`].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-gray-400">Applied {new Date(a.createdAt).toLocaleString()}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{a.statusLabel}</span>
            </button>
            {open === a.id && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Applicant</p>
                  <p>{a.applicant.headline}</p>
                  <p className="text-gray-600">{a.applicant.email} · {a.applicant.phone}</p>
                  <p className="text-gray-600">{[a.applicant.city, a.applicant.country].filter(Boolean).join(', ')}{a.applicant.yearsExperience != null ? ` · ${a.applicant.yearsExperience} yrs` : ''}</p>
                  {a.applicant.skills.length > 0 && <p className="text-gray-600">{a.applicant.skills.join(', ')}</p>}
                  {a.applicant.cvUrl ? <a href={a.applicant.cvUrl} className="text-brand-600 font-semibold">Download CV ({a.applicant.cvName})</a> : <p className="text-red-600">CV unavailable</p>}
                  {a.coverLetter && <p className="whitespace-pre-line bg-gray-50 rounded-lg p-2">{a.coverLetter}</p>}
                  <p className="text-xs font-semibold uppercase text-gray-500 pt-2">Employer apply links</p>
                  {a.applyOptions.length === 0 && !a.shareLink && <p className="text-gray-500">None found; search the company site.</p>}
                  {a.applyOptions.map(o => <a key={o.link} href={o.link} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">{o.title || o.link}</a>)}
                  {a.shareLink && <a href={a.shareLink} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">Google Jobs listing</a>}
                  {a.description && <details><summary className="cursor-pointer text-gray-500">Job description</summary><p className="whitespace-pre-line text-gray-700 mt-1">{a.description}</p></details>}
                </div>
                <div className="space-y-2">
                  {a.status === 'withdrawn' ? <p className="text-gray-500">The applicant withdrew this application.</p> : (<>
                    <label className="block text-xs font-semibold text-gray-600">Status</label>
                    <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5">
                      {JOB_APP_STEPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <label className="block text-xs font-semibold text-gray-600">Message to the applicant (emailed; no employer contact details)</label>
                    <textarea value={draft.message} onChange={e => setDraft({ ...draft, message: e.target.value })} rows={4} maxLength={2000} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                    <label className="block text-xs font-semibold text-gray-600">Internal note</label>
                    <textarea value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} rows={2} maxLength={1000} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                    <button onClick={() => save(a)} disabled={busy} className="px-4 py-2 bg-btn text-white rounded-lg font-semibold disabled:bg-gray-300">{busy ? 'Saving…' : 'Save and notify'}</button>
                  </>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminStudyApplication {
  id: string; sub: string; type: 'admission' | 'scholarship'; program: string; intake: string; status: string; statusLabel: string; message: string;
  fee: { fee: number; service: number; total: number; label: string; paidAt: string | null } | null; feeCharged: number | null;
  createdAt: string; updatedAt: string; note: string; adminNote: string;
  institution: { name: string; placeType: string | null; address: string; website: string | null; phone: string | null; mapsLink: string | null; link: string | null; source: string | null; description: string };
  applicant: Record<string, unknown> & {
    name: string; email: string; phone: string; education: { school: string; qualification: string; field: string; grade: string; country: string; start: string; end: string }[];
    tests: { test: string; score: string; date: string }[];
  };
  docs: { kind: string; label: string; name: string; url: string | null }[];
}

const STUDY_STEPS: [string, string][] = [
  ['submitted', 'Received'], ['docs_needed', 'More documents needed'], ['fee_due', 'Quote fee (fee to pay)'], ['processing', 'Lyrtrip is applying'],
  ['applied', 'Submitted to institution'], ['interview', 'Interview requested'], ['offer', 'Offer / award received'], ['rejected', 'Not successful'],
];
const APPLICANT_FIELDS: [string, string][] = [
  ['dateOfBirth', 'Date of birth'], ['gender', 'Gender'], ['nationality', 'Nationality'], ['countryOfResidence', 'Residence'], ['city', 'City'], ['address', 'Address'],
  ['passportNumber', 'Passport'], ['passportExpiry', 'Passport expiry'], ['studyLevel', 'Level'], ['fieldsOfStudy', 'Fields'], ['preferredCountries', 'Countries'],
  ['budgetPerYear', 'Budget / year'], ['fundingSource', 'Funding'], ['englishWaiver', 'English waiver'], ['languages', 'Languages'], ['workYears', 'Work years'],
  ['guardianName', 'Guardian'], ['guardianPhone', 'Guardian phone'],
];

// Study applications made through Lyrtrip: check documents, quote the institution's fee (+ service), apply, relay results
export function StudyApplicationsPanel({ call }: { call: Call }) {
  const [data, setData] = useState<{ applications: AdminStudyApplication[]; payingStudents: number; studentProfiles: number; serviceRate: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState({ status: '', message: '', note: '', fee: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    call({ action: 'studyapps.list' }).then(d => setData(d as unknown as NonNullable<typeof data>)).catch(() => setData({ applications: [], payingStudents: 0, studentProfiles: 0, serviceRate: 0.1 }));
  }, [call]);
  useEffect(() => { load(); }, [load]);
  const rows = data?.applications ?? null;
  const expand = (a: AdminStudyApplication) => {
    setOpen(open === a.id ? null : a.id);
    setDraft({ status: a.status === 'withdrawn' ? 'submitted' : a.status, message: '', note: a.adminNote, fee: a.fee ? String(a.fee.fee) : '' });
  };
  const save = async (a: AdminStudyApplication) => {
    setBusy(true);
    try {
      await call({ action: 'studyapps.update', id: a.id, status: draft.status, message: draft.message, note: draft.note, fee: draft.fee === '' ? undefined : Number(draft.fee) });
      setOpen(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update the application');
    }
    setBusy(false);
  };
  const count = (s: string) => (rows ?? []).filter(r => r.status === s).length;
  const rate = data?.serviceRate ?? 0.1;
  const feeNum = Number(draft.fee) || 0;
  const earned = (rows ?? []).filter(r => r.fee?.paidAt).reduce((s, r) => s + (r.fee?.service ?? 0), 0);
  const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v == null ? '' : String(v));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ['Student profiles', String(data?.studentProfiles ?? 0)], ['Paying students', String(data?.payingStudents ?? 0)],
          ['To review', String(count('submitted'))], ['Fee paid, to apply', String(count('processing'))], ['Service earned', usd(earned)],
        ].map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No study applications yet.</p>}
        {rows?.map(a => (
          <div key={a.id} className="p-4 text-sm">
            <button onClick={() => expand(a)} className="w-full flex flex-wrap items-start justify-between gap-2 text-left">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{a.applicant.name} <span className="font-normal text-gray-500">· {a.type}</span> · {a.program}</p>
                <p className="text-gray-600">{[a.institution.name, a.institution.address].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-gray-400">Applied {new Date(a.createdAt).toLocaleString()}{a.intake ? ` · intake ${a.intake}` : ''}{a.fee ? ` · ${usd(a.fee.total)}${a.fee.paidAt ? ' paid' : ' due'}` : ''}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{a.statusLabel}</span>
            </button>
            {open === a.id && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Institution (hidden from the student)</p>
                  {a.institution.website && <a href={a.institution.website} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">Website: {a.institution.website}</a>}
                  {a.institution.link && <a href={a.institution.link} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">Page: {a.institution.source ?? a.institution.link}</a>}
                  {a.institution.mapsLink && <a href={a.institution.mapsLink} target="_blank" rel="noopener noreferrer" className="block text-brand-600">Map</a>}
                  {a.institution.phone && <p>Phone: {a.institution.phone}</p>}
                  {a.institution.description && <p className="text-gray-600 whitespace-pre-line">{a.institution.description}</p>}
                  <p className="text-xs font-semibold uppercase text-gray-500 pt-2">Student</p>
                  <p className="text-gray-700">{a.applicant.email} · {a.applicant.phone}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-gray-700">
                    {APPLICANT_FIELDS.filter(([k]) => show(a.applicant[k])).map(([k, l]) => <React.Fragment key={k}><dt className="text-gray-500">{l}</dt><dd>{show(a.applicant[k])}</dd></React.Fragment>)}
                  </dl>
                  {a.applicant.education.map((e, i) => <p key={i} className="text-gray-700">🎓 {[e.qualification, e.field, e.school, e.country].filter(Boolean).join(', ')} · {e.grade} ({e.start}–{e.end})</p>)}
                  {a.applicant.tests.map((t, i) => <p key={i} className="text-gray-700">📝 {t.test} {t.score} {t.date && `(${t.date})`}</p>)}
                  {['goals', 'achievements'].map(k => show(a.applicant[k]) && <details key={k}><summary className="cursor-pointer text-gray-500">{k === 'goals' ? 'Study goals' : 'Achievements'}</summary><p className="whitespace-pre-line mt-1">{show(a.applicant[k])}</p></details>)}
                  {a.note && <p className="whitespace-pre-line bg-gray-50 rounded-lg p-2">Student note: {a.note}</p>}
                  <p className="text-xs font-semibold uppercase text-gray-500 pt-2">Documents</p>
                  {a.docs.map(d => <a key={d.kind} href={d.url ?? '#'} className="block text-brand-600 truncate">{d.label}: {d.name}</a>)}
                </div>
                <div className="space-y-2">
                  {a.status === 'withdrawn' ? <p className="text-gray-500">The student withdrew this application.</p> : (<>
                    <label className="block text-xs font-semibold text-gray-600">Status</label>
                    <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5">
                      {STUDY_STEPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {draft.status === 'fee_due' && !a.fee?.paidAt && (<>
                      <label className="block text-xs font-semibold text-gray-600">Institution {a.type} fee (USD; 0 if none)</label>
                      <input type="number" min={0} step="0.01" value={draft.fee} onChange={e => setDraft({ ...draft, fee: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                      <p className="text-xs text-gray-600">Student pays {usd(feeNum)} + {Math.round(rate * 100)}% service {usd(Math.round(feeNum * rate * 100) / 100)} = <b>{usd(Math.round(feeNum * (1 + rate) * 100) / 100)}</b>. 0 skips payment and moves to &quot;Lyrtrip is applying&quot;.</p>
                    </>)}
                    {a.fee?.paidAt && <p className="text-emerald-700">Paid {usd(a.feeCharged ?? a.fee.total)} on {new Date(a.fee.paidAt).toLocaleDateString()}</p>}
                    <label className="block text-xs font-semibold text-gray-600">Message to the student (emailed; no institution contact details)</label>
                    <textarea value={draft.message} onChange={e => setDraft({ ...draft, message: e.target.value })} rows={4} maxLength={2000} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                    <label className="block text-xs font-semibold text-gray-600">Internal note</label>
                    <textarea value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} rows={2} maxLength={1000} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                    <button onClick={() => save(a)} disabled={busy} className="px-4 py-2 bg-btn text-white rounded-lg font-semibold disabled:bg-gray-300">{busy ? 'Saving…' : 'Save and notify'}</button>
                  </>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminEventRequest {
  id: string; status: string; statusLabel: string; ticketType: string; seatTogether: boolean; maxPerTicket: number | null; eventDate: string;
  quantity: number; accessibility: string; note: string; adminNote: string; accountEmail: string; createdAt: string;
  event: { name: string; when: string | null; venue: string | null; address: string };
  eventFull: { link: string | null; ticketLink: string | null; ticketSource: string | null; mapsLink: string | null; description: string; tickets?: { source: string | null; link: string; type: string | null }[] };
  contact: { name: string; email: string; phone: string; country: string };
  attendees: { fullName: string; dateOfBirth: string; nationality: string; idType: string; idNumber: string }[];
  quote: { amount: number; service: number; total: number; details: string; expiresAt: string; paidAt: string | null } | null;
  charged: number | null; refund: { amount: number; at: string } | null;
}

const EVENT_STEPS: [string, string][] = [
  ['submitted', 'Received'], ['info_needed', 'More details needed'], ['quoted', 'Quote price (price to pay)'], ['processing', 'Paid: getting tickets'],
  ['ticketed', 'Tickets sent'], ['unavailable', 'Not available (refunds if paid)'], ['refunded', 'Refund in full'],
];

// Event tickets sold through Lyrtrip: find the tickets, quote the price (+ service), buy them once paid, or refund
export function EventTicketsPanel({ call }: { call: Call }) {
  const [data, setData] = useState<{ requests: AdminEventRequest[]; serviceRate: number; quoteHours: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState({ status: '', message: '', note: '', price: '', quoteDetails: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    call({ action: 'eventtix.list' }).then(d => setData(d as unknown as NonNullable<typeof data>)).catch(() => setData({ requests: [], serviceRate: 0.05, quoteHours: 72 }));
  }, [call]);
  useEffect(() => { load(); }, [load]);
  const rows = data?.requests ?? null;
  const expand = (r: AdminEventRequest) => {
    setOpen(open === r.id ? null : r.id);
    setDraft({ status: r.status === 'cancelled' ? 'submitted' : r.status, message: '', note: r.adminNote, price: r.quote ? String(r.quote.amount) : '', quoteDetails: r.quote?.details ?? '' });
  };
  const save = async (r: AdminEventRequest) => {
    const paid = !!r.quote?.paidAt;
    if (paid && ['unavailable', 'refunded'].includes(draft.status) && !confirm(`Refund ${usd(r.charged ?? r.quote!.total)} to ${r.contact.name}'s card?`)) return;
    setBusy(true);
    try {
      await call({ action: 'eventtix.update', id: r.id, status: draft.status, message: draft.message, note: draft.note, price: draft.price === '' ? undefined : Number(draft.price), quoteDetails: draft.quoteDetails });
      setOpen(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update the request');
    }
    setBusy(false);
  };
  const count = (s: string) => (rows ?? []).filter(r => r.status === s).length;
  const rate = data?.serviceRate ?? 0.05;
  const priceNum = Number(draft.price) || 0;
  const earned = (rows ?? []).filter(r => r.quote?.paidAt && !r.refund).reduce((s, r) => s + (r.quote?.service ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['To quote', String(count('submitted'))], ['Awaiting payment', String(count('quoted'))],
          ['Paid, to buy', String(count('processing'))], ['Service earned', usd(earned)],
        ].map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No ticket requests yet.</p>}
        {rows?.map(r => (
          <div key={r.id} className="p-4 text-sm">
            <button onClick={() => expand(r)} className="w-full flex flex-wrap items-start justify-between gap-2 text-left">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{r.contact.name} · {r.quantity} × {r.ticketType}</p>
                <p className="text-gray-600">{r.event.name} · {[r.eventDate || r.event.when, r.event.venue || r.event.address].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-gray-400">Requested {new Date(r.createdAt).toLocaleString()}{r.maxPerTicket ? ` · max ${usd(r.maxPerTicket)}/ticket` : ''}{r.quote ? ` · ${usd(r.quote.total)}${r.quote.paidAt ? ' paid' : ' quoted'}` : ''}{r.refund ? ' · refunded' : ''}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{r.statusLabel}</span>
            </button>
            {open === r.id && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Where to buy (hidden from the customer)</p>
                  {(r.eventFull.tickets ?? []).map(t => <a key={t.link} href={t.link} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">{t.type === 'tickets' ? 'Tickets' : 'Info'}: {t.source ?? t.link}</a>)}
                  {!r.eventFull.tickets?.length && r.eventFull.ticketLink && <a href={r.eventFull.ticketLink} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">Tickets: {r.eventFull.ticketSource ?? r.eventFull.ticketLink}</a>}
                  {r.eventFull.link && <a href={r.eventFull.link} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">Event page</a>}
                  {r.eventFull.mapsLink && <a href={r.eventFull.mapsLink} target="_blank" rel="noopener noreferrer" className="block text-brand-600">Map</a>}
                  {r.eventFull.description && <p className="text-gray-600 whitespace-pre-line">{r.eventFull.description}</p>}
                  <p className="text-xs font-semibold uppercase text-gray-500 pt-2">Customer</p>
                  <p className="text-gray-700">{r.contact.name} · {r.contact.email} · {r.contact.phone} · {r.contact.country}</p>
                  {r.accountEmail && r.accountEmail !== r.contact.email && <p className="text-xs text-gray-500">Account: {r.accountEmail}</p>}
                  <p className="text-gray-700">{r.ticketType}{r.quantity > 1 ? (r.seatTogether ? ' · seats together' : ' · seats can be apart') : ''}{r.maxPerTicket ? ` · up to ${usd(r.maxPerTicket)} each` : ''}</p>
                  {r.eventDate && <p className="text-gray-700">Date / session: {r.eventDate}</p>}
                  <p className="text-xs font-semibold uppercase text-gray-500 pt-2">Attendees</p>
                  {r.attendees.map((a, i) => <p key={i} className="text-gray-700">{i + 1}. {a.fullName} · born {a.dateOfBirth} · {a.nationality} · {a.idType} {a.idNumber}</p>)}
                  {r.accessibility && <p className="text-gray-700">Accessibility: {r.accessibility}</p>}
                  {r.note && <p className="whitespace-pre-line bg-gray-50 rounded-lg p-2">Customer note: {r.note}</p>}
                </div>
                <div className="space-y-2">
                  {r.status === 'cancelled' || r.status === 'refunded' ? (
                    <p className="text-gray-500">{r.status === 'cancelled' ? 'The customer cancelled this request.' : `Refunded ${usd(r.refund?.amount ?? 0)} on ${r.refund ? new Date(r.refund.at).toLocaleDateString() : ''}.`}</p>
                  ) : (<>
                    <label className="block text-xs font-semibold text-gray-600">Status</label>
                    <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5">
                      {EVENT_STEPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {draft.status === 'quoted' && !r.quote?.paidAt && (<>
                      <label className="block text-xs font-semibold text-gray-600">Total for all {r.quantity} ticket(s), with booking fees (USD)</label>
                      <input type="number" min={1} step="0.01" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                      <label className="block text-xs font-semibold text-gray-600">What they get (shown to the customer)</label>
                      <input value={draft.quoteDetails} maxLength={500} onChange={e => setDraft({ ...draft, quoteDetails: e.target.value })} placeholder="e.g. Block 112, row F, seats together; e-tickets" className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                      <p className="text-xs text-gray-600">Customer pays {usd(priceNum)} + {Math.round(rate * 100)}% service {usd(Math.round(priceNum * rate * 100) / 100)} = <b>{usd(Math.round(priceNum * (1 + rate) * 100) / 100)}</b>, within {data?.quoteHours ?? 72} hours.</p>
                    </>)}
                    {r.quote?.paidAt && <p className="text-emerald-700">Paid {usd(r.charged ?? r.quote.total)} on {new Date(r.quote.paidAt).toLocaleDateString()}</p>}
                    {r.quote?.paidAt && ['unavailable', 'refunded'].includes(draft.status) && <p className="text-red-700 text-xs">Saving refunds the card in full.</p>}
                    <label className="block text-xs font-semibold text-gray-600">Message to the customer (emailed; no outside links)</label>
                    <textarea value={draft.message} onChange={e => setDraft({ ...draft, message: e.target.value })} rows={4} maxLength={2000}
                      placeholder={draft.status === 'ticketed' ? 'e.g. Your e-tickets are attached to the email from Lyrtrip; order LT-1234' : ''} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                    <label className="block text-xs font-semibold text-gray-600">Internal note</label>
                    <textarea value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} rows={2} maxLength={1000} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                    <button onClick={() => save(r)} disabled={busy} className="px-4 py-2 bg-btn text-white rounded-lg font-semibold disabled:bg-gray-300">{busy ? 'Saving…' : 'Save and notify'}</button>
                  </>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminTourRequest {
  id: string; category: string; label: string; status: string; statusLabel: string; createdAt: string; accountEmail: string; adminNote: string;
  item: { name: string; placeType: string | null; address: string };
  itemFull: { link: string | null; website: string | null; phone: string | null; mapsLink: string | null; source: string | null; description: string; from?: string; destination?: string };
  contact: { name: string; email: string; phone: string; country: string };
  trip: { from: string; destination: string; startDate: string; nights: number; flexibleDays: number; hotel: string; rooms: string; meals: string; flights: boolean; budgetPerPerson: number | null } | null;
  travellers: { fullName: string; dateOfBirth: string; gender: string; nationality: string; idType: string; idNumber: string; idExpiry: string }[];
  extras: Record<string, unknown>; fieldLabels: Record<string, string>; specialNeeds: string; note: string;
  docs: { kind: string; label: string; name: string; url: string | null }[];
  quote: { amount: number; service: number; total: number; details: string; expiresAt: string; paidAt: string | null } | null;
  charged: number | null; refund: { amount: number; at: string } | null;
}

const TOUR_STEPS: [string, string][] = [
  ['submitted', 'Received'], ['info_needed', 'More details or documents needed'], ['quoted', 'Quote price (price to pay)'], ['processing', 'Paid: booking'],
  ['confirmed', 'Booked'], ['unavailable', 'Not available (refunds if paid)'], ['refunded', 'Refund in full'],
];

// Tours, pilgrimages and travel services sold through Lyrtrip: check details and documents, quote (+ service), book or refund
export function TourRequestsPanel({ call }: { call: Call }) {
  const [data, setData] = useState<{ requests: AdminTourRequest[]; serviceRate: number; quoteHours: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState({ status: '', message: '', note: '', price: '', quoteDetails: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    call({ action: 'tourreqs.list' }).then(d => setData(d as unknown as NonNullable<typeof data>)).catch(() => setData({ requests: [], serviceRate: 0.05, quoteHours: 72 }));
  }, [call]);
  useEffect(() => { load(); }, [load]);
  const rows = data?.requests ?? null;
  const expand = (r: AdminTourRequest) => {
    setOpen(open === r.id ? null : r.id);
    setDraft({ status: r.status === 'cancelled' ? 'submitted' : r.status, message: '', note: r.adminNote, price: r.quote ? String(r.quote.amount) : '', quoteDetails: r.quote?.details ?? '' });
  };
  const save = async (r: AdminTourRequest) => {
    const paid = !!r.quote?.paidAt;
    if (paid && ['unavailable', 'refunded'].includes(draft.status) && !confirm(`Refund ${usd(r.charged ?? r.quote!.total)} to ${r.contact.name}'s card?`)) return;
    setBusy(true);
    try {
      await call({ action: 'tourreqs.update', id: r.id, status: draft.status, message: draft.message, note: draft.note, price: draft.price === '' ? undefined : Number(draft.price), quoteDetails: draft.quoteDetails });
      setOpen(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update the request');
    }
    setBusy(false);
  };
  const count = (s: string) => (rows ?? []).filter(r => r.status === s).length;
  const rate = data?.serviceRate ?? 0.05;
  const priceNum = Number(draft.price) || 0;
  const earned = (rows ?? []).filter(r => r.quote?.paidAt && !r.refund).reduce((s, r) => s + (r.quote?.service ?? 0), 0);
  const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v == null ? '' : String(v));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['To quote', String(count('submitted'))], ['Awaiting payment', String(count('quoted'))],
          ['Paid, to book', String(count('processing'))], ['Service earned', usd(earned)],
        ].map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No tour requests yet.</p>}
        {rows?.map(r => (
          <div key={r.id} className="p-4 text-sm">
            <button onClick={() => expand(r)} className="w-full flex flex-wrap items-start justify-between gap-2 text-left">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{r.contact.name} · {r.label} · {r.travellers.length} {r.trip ? 'traveller' : 'applicant'}{r.travellers.length > 1 ? 's' : ''}</p>
                <p className="text-gray-600">{r.item.name}{r.trip ? ` · ${r.trip.from} → ${r.trip.destination}, ${r.trip.startDate}, ${r.trip.nights}n` : ''}</p>
                <p className="text-xs text-gray-400">Requested {new Date(r.createdAt).toLocaleString()} · {r.docs.length} docs{r.quote ? ` · ${usd(r.quote.total)}${r.quote.paidAt ? ' paid' : ' quoted'}` : ''}{r.refund ? ' · refunded' : ''}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{r.statusLabel}</span>
            </button>
            {open === r.id && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Listing (hidden from the customer)</p>
                  {r.itemFull.link && <a href={r.itemFull.link} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">Page: {r.itemFull.source ?? r.itemFull.link}</a>}
                  {r.itemFull.website && <a href={r.itemFull.website} target="_blank" rel="noopener noreferrer" className="block text-brand-600 truncate">Website: {r.itemFull.website}</a>}
                  {r.itemFull.mapsLink && <a href={r.itemFull.mapsLink} target="_blank" rel="noopener noreferrer" className="block text-brand-600">Map</a>}
                  {r.itemFull.phone && <p>Phone: {r.itemFull.phone}</p>}
                  {r.itemFull.description && <p className="text-gray-600 whitespace-pre-line">{r.itemFull.description}</p>}
                  <p className="text-xs font-semibold uppercase text-gray-500 pt-2">Customer</p>
                  <p className="text-gray-700">{r.contact.name} · {r.contact.email} · {r.contact.phone} · {r.contact.country}</p>
                  {r.accountEmail && r.accountEmail !== r.contact.email && <p className="text-xs text-gray-500">Account: {r.accountEmail}</p>}
                  {r.trip && (<>
                    <p className="text-xs font-semibold uppercase text-gray-500 pt-2">Trip</p>
                    <p className="text-gray-700">{r.trip.from} → {r.trip.destination} · {r.trip.startDate} (±{r.trip.flexibleDays || 0} days) · {r.trip.nights} nights</p>
                    <p className="text-gray-700">{[r.trip.hotel, r.trip.rooms, r.trip.meals, r.trip.flights && 'with flights', r.trip.budgetPerPerson && `budget ${usd(r.trip.budgetPerPerson)}/person`].filter(Boolean).join(' · ') || 'No hotel or meal preferences'}</p>
                  </>)}
                  {Object.keys(r.extras).length > 0 && (<>
                    <p className="text-xs font-semibold uppercase text-gray-500 pt-2">{r.label} details</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-gray-700">
                      {Object.entries(r.extras).map(([k, v]) => <React.Fragment key={k}><dt className="text-gray-500">{r.fieldLabels[k] ?? k}</dt><dd>{show(v)}</dd></React.Fragment>)}
                    </dl>
                  </>)}
                  <p className="text-xs font-semibold uppercase text-gray-500 pt-2">{r.trip ? 'Travellers' : 'Applicants'}</p>
                  {r.travellers.map((t, i) => <p key={i} className="text-gray-700">{i + 1}. {t.fullName} · {t.gender} · born {t.dateOfBirth} · {t.nationality} · {t.idType} {t.idNumber}{t.idExpiry ? ` (exp. ${t.idExpiry})` : ''}</p>)}
                  {r.specialNeeds && <p className="text-gray-700">Needs: {r.specialNeeds}</p>}
                  {r.note && <p className="whitespace-pre-line bg-gray-50 rounded-lg p-2">Customer note: {r.note}</p>}
                  <p className="text-xs font-semibold uppercase text-gray-500 pt-2">Documents</p>
                  {r.docs.length === 0 && <p className="text-gray-500">None uploaded</p>}
                  {r.docs.map((d, i) => <a key={i} href={d.url ?? '#'} className="block text-brand-600 truncate">{d.label}: {d.name}</a>)}
                </div>
                <div className="space-y-2">
                  {r.status === 'cancelled' || r.status === 'refunded' ? (
                    <p className="text-gray-500">{r.status === 'cancelled' ? 'The customer cancelled this request.' : `Refunded ${usd(r.refund?.amount ?? 0)} on ${r.refund ? new Date(r.refund.at).toLocaleDateString() : ''}.`}</p>
                  ) : (<>
                    <label className="block text-xs font-semibold text-gray-600">Status</label>
                    <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5">
                      {TOUR_STEPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {draft.status === 'quoted' && !r.quote?.paidAt && (<>
                      <label className="block text-xs font-semibold text-gray-600">Total for everyone, with all fees (USD)</label>
                      <input type="number" min={1} step="0.01" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                      <label className="block text-xs font-semibold text-gray-600">What&apos;s included (shown to the customer)</label>
                      <textarea value={draft.quoteDetails} maxLength={1000} rows={3} onChange={e => setDraft({ ...draft, quoteDetails: e.target.value })} placeholder="e.g. Return flights, 4-star hotels 600 m from Haram, visa, transport, ziyarah" className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                      <p className="text-xs text-gray-600">Customer pays {usd(priceNum)} + {Math.round(rate * 100)}% service {usd(Math.round(priceNum * rate * 100) / 100)} = <b>{usd(Math.round(priceNum * (1 + rate) * 100) / 100)}</b>, within {data?.quoteHours ?? 72} hours.</p>
                    </>)}
                    {r.quote?.paidAt && <p className="text-emerald-700">Paid {usd(r.charged ?? r.quote.total)} on {new Date(r.quote.paidAt).toLocaleDateString()}</p>}
                    {r.quote?.paidAt && ['unavailable', 'refunded'].includes(draft.status) && <p className="text-red-700 text-xs">Saving refunds the card in full.</p>}
                    <label className="block text-xs font-semibold text-gray-600">Message to the customer (emailed; no outside links)</label>
                    <textarea value={draft.message} onChange={e => setDraft({ ...draft, message: e.target.value })} rows={4} maxLength={3000}
                      placeholder={draft.status === 'confirmed' ? 'e.g. Booking ref, itinerary, hotel names, flight times' : draft.status === 'info_needed' ? 'What to add or upload' : ''} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                    <label className="block text-xs font-semibold text-gray-600">Internal note</label>
                    <textarea value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} rows={2} maxLength={1000} className="w-full border border-gray-300 rounded-lg px-2 py-1.5" />
                    <button onClick={() => save(r)} disabled={busy} className="px-4 py-2 bg-btn text-white rounded-lg font-semibold disabled:bg-gray-300">{busy ? 'Saving…' : 'Save and notify'}</button>
                  </>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminDonation {
  id: string; charityId: string; charity: string; cause: string; giftType: string; amount: number; service: number; total: number;
  status: 'paid' | 'forwarded' | 'refunded'; dedication: string; message: string; createdAt: string; paidAt: string | null;
  donor: { name: string; email: string; country: string; anonymous: boolean };
  forward: { at: string; reference: string } | null; refund: { amount: number; at: string } | null; charged: number | null;
}

// Donations collected for charities: what each one is owed, recording that it was passed on, and refunds
export function DonationsPanel({ call }: { call: Call }) {
  const [data, setData] = useState<{ donations: AdminDonation[]; charities: Record<string, string>; serviceRate: number } | null>(null);
  const [ref, setRef] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    call({ action: 'donations.list' }).then(d => setData(d as unknown as NonNullable<typeof data>)).catch(() => setData({ donations: [], charities: {}, serviceRate: 0.05 }));
  }, [call]);
  useEffect(() => { load(); }, [load]);
  const rows = data?.donations ?? null;
  const owed = Object.entries((rows ?? []).filter(d => d.status === 'paid').reduce<Record<string, AdminDonation[]>>((m, d) => ({ ...m, [d.charityId]: [...(m[d.charityId] ?? []), d] }), {}));
  const sum = (list: AdminDonation[], k: 'amount' | 'service') => list.reduce((s, d) => s + d[k], 0);
  const live = (rows ?? []).filter(d => d.status !== 'refunded');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); load(); } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    setBusy(false);
  };
  const forward = (charityId: string, list: AdminDonation[]) => run(async () => {
    if (!confirm(`Mark ${list.length} donation(s), ${usd(sum(list, 'amount'))} in total, as passed on to ${data?.charities[charityId]}? Each donor is emailed.`)) return;
    await call({ action: 'donations.forward', charityId, ids: list.map(d => d.id), reference: ref[charityId] ?? '' });
  });
  const refund = (d: AdminDonation) => run(async () => {
    if (!confirm(`Refund ${usd(d.charged ?? d.total)} to ${d.donor.name}?`)) return;
    await call({ action: 'donations.refund', id: d.id });
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Donations', String(live.length)], ['Given (all time)', usd(sum(live, 'amount'))],
          ['To pass on now', usd(owed.reduce((s, [, l]) => s + sum(l, 'amount'), 0))], ['Service earned', usd(sum(live, 'service'))],
        ].map(([l, v]) => <div key={l} className={`${panel} p-3`}><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-gray-900">{v}</p></div>)}
      </div>
      {owed.length > 0 && (
        <div className={`${panel} p-4 space-y-3`}>
          <p className="font-semibold text-gray-900">To pass on</p>
          <p className="text-xs text-gray-500">Donate the total to each charity from Lyrtrip&apos;s account (on its official donation page or by bank transfer), then record the reference here.</p>
          {owed.map(([id, list]) => (
            <div key={id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-gray-900 min-w-[12rem]">{data?.charities[id] ?? id}</span>
              <span>{list.length} gift(s) · <b>{usd(sum(list, 'amount'))}</b></span>
              <input value={ref[id] ?? ''} onChange={e => setRef({ ...ref, [id]: e.target.value })} placeholder="Charity receipt or transfer reference" className="flex-1 min-w-[12rem] border border-gray-300 rounded-lg px-2 py-1.5" />
              <button onClick={() => forward(id, list)} disabled={busy || (ref[id] ?? '').trim().length < 3} className="px-3 py-1.5 bg-btn text-white rounded-lg font-semibold disabled:bg-gray-300">Mark passed on</button>
            </div>
          ))}
        </div>
      )}
      <div className={`${panel} divide-y divide-gray-100`}>
        {rows === null && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="p-4 text-sm text-gray-500">No donations yet.</p>}
        {rows?.map(d => (
          <div key={d.id} className="p-4 text-sm flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{usd(d.amount)} · {d.charity} <span className="font-normal text-gray-500">· {d.giftType} · {d.cause}</span></p>
              <p className="text-gray-600">{d.donor.name}{d.donor.anonymous ? ' (anonymous to the charity)' : ''} · {d.donor.email}{d.donor.country ? ` · ${d.donor.country}` : ''}</p>
              <p className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleString()} · paid {usd(d.charged ?? d.total)} incl. {usd(d.service)} service · {d.id}</p>
              {(d.dedication || d.message) && <p className="text-gray-600">{d.dedication && `In honour/memory of ${d.dedication}. `}{d.message}</p>}
              {d.forward && <p className="text-emerald-700 text-xs">Passed on {new Date(d.forward.at).toLocaleDateString()} · ref {d.forward.reference}</p>}
            </div>
            <div className="text-right space-y-1">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{d.status === 'paid' ? 'To pass on' : d.status === 'forwarded' ? 'Passed on' : 'Refunded'}</span>
              {d.status === 'paid' && <button onClick={() => refund(d)} disabled={busy} className="block ml-auto text-xs text-red-600 underline">Refund</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
