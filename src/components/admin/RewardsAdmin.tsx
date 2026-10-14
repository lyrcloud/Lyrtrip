'use client';

import { useCallback, useEffect, useState } from 'react';

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
