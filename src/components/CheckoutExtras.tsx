'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { rewardsCall, type CheckoutExtrasValue, type RewardsQuote } from '@/lib/rewards';

interface Props {
  kind: 'flight' | 'hotel';
  // The retail total shown to the guest (12% service fee included)
  listedTotal: number | null;
  currency: string;
  signedIn: boolean;
  value: CheckoutExtrasValue;
  onChange: (value: CheckoutExtrasValue) => void;
  onQuote: (quote: RewardsQuote | null) => void;
}


// Coupon, gift card and points at checkout, plus business pricing for approved business accounts.
// The server prices all of it again when the guest pays.
export default function CheckoutExtras({ kind, listedTotal, currency, signedIn, value, onChange, onQuote }: Props) {
  const [quote, setQuote] = useState<RewardsQuote | null>(null);
  const [coupon, setCoupon] = useState(value.couponCode);
  const [giftCard, setGiftCard] = useState(value.giftCardCode);
  const [open, setOpen] = useState(!!(value.couponCode || value.giftCardCode));
  const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  useEffect(() => {
    if (!listedTotal) { setQuote(null); onQuote(null); return; }
    let live = true;
    const timer = setTimeout(() => {
      rewardsCall<RewardsQuote>({ action: 'quote', kind, listedTotal, currency, ...value })
        .then(q => { if (live) { setQuote(q); onQuote(q); } })
        .catch(() => { if (live) { setQuote(null); onQuote(null); } });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
    // onQuote is a parent setter; re-quote only when the inputs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, listedTotal, currency, value.couponCode, value.giftCardCode, value.usePoints, signedIn]);

  const input = 'flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-500';
  const applyBtn = 'px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
  const err = quote?.errors ?? {};
  const credited = quote && (quote.coupon || quote.giftCard || quote.points || quote.businessSavings);

  return (
    <div className="border border-gray-200 rounded-xl p-3 mb-4 text-sm">
      {quote?.buyerType === 'business' && (
        <p className="mb-2 text-emerald-700 font-medium">
          Business rate for {quote.company}{quote.businessSavings > 0 ? `: you save ${usd(quote.businessSavings)}` : ''}
        </p>
      )}

      {signedIn ? (
        quote && quote.pointsAvailable > 0 && (
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={value.usePoints} onChange={e => onChange({ ...value, usePoints: e.target.checked })} />
            <span>Use my points ({quote.pointsAvailable.toLocaleString()} = ${(quote.pointsAvailable / 100).toFixed(2)})</span>
          </label>
        )
      ) : (
        <p className="mb-2 text-gray-600">
          <Link href="/login" className="text-brand-600 font-medium underline">Sign in</Link> to earn points on this booking and spend the ones you have.
        </p>
      )}
      {err.points && <p className="text-red-600 text-xs mb-2">{err.points}</p>}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-brand-600 font-medium hover:underline">
          Have a coupon or gift card?
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input className={input} placeholder="Coupon code" value={coupon} onChange={e => setCoupon(e.target.value)} />
            {value.couponCode
              ? <button type="button" className={applyBtn} onClick={() => { setCoupon(''); onChange({ ...value, couponCode: '' }); }}>Remove</button>
              : <button type="button" className={applyBtn} onClick={() => onChange({ ...value, couponCode: coupon.trim() })} disabled={!coupon.trim()}>Apply</button>}
          </div>
          {err.coupon && <p className="text-red-600 text-xs">{err.coupon}</p>}
          <div className="flex gap-2">
            <input className={input} placeholder="Gift card code" value={giftCard} onChange={e => setGiftCard(e.target.value)} />
            {value.giftCardCode
              ? <button type="button" className={applyBtn} onClick={() => { setGiftCard(''); onChange({ ...value, giftCardCode: '' }); }}>Remove</button>
              : <button type="button" className={applyBtn} onClick={() => onChange({ ...value, giftCardCode: giftCard.trim() })} disabled={!giftCard.trim()}>Apply</button>}
          </div>
          {err.giftCard && <p className="text-red-600 text-xs">{err.giftCard}</p>}
        </div>
      )}
      {err.general && <p className="text-red-600 text-xs mt-2">{err.general}</p>}

      {quote && credited ? (
        <div className="mt-3 pt-2 border-t border-gray-100 space-y-1 text-gray-700">
          {quote.businessSavings > 0 && <div className="flex justify-between"><span>Business rate</span><span>−{usd(quote.businessSavings)}</span></div>}
          {quote.coupon > 0 && <div className="flex justify-between"><span>Coupon {quote.couponInfo?.code}</span><span>−{usd(quote.coupon)}</span></div>}
          {quote.giftCard > 0 && <div className="flex justify-between"><span>Gift card {quote.giftCardInfo?.code}</span><span>−{usd(quote.giftCard)}</span></div>}
          {quote.points > 0 && <div className="flex justify-between"><span>{quote.points.toLocaleString()} points</span><span>−{usd(quote.pointsValue)}</span></div>}
          <div className="flex justify-between font-bold text-gray-900"><span>To pay by card</span><span>{usd(quote.amountDue)}</span></div>
          {quote.giftCardInfo && <p className="text-xs text-gray-500">Gift card balance after this booking: {usd(quote.giftCardInfo.remainingAfter)}</p>}
        </div>
      ) : null}
      {quote && quote.pointsEarned > 0 && (
        <p className="mt-2 text-xs text-emerald-700">You&apos;ll earn {quote.pointsEarned.toLocaleString()} points once this booking is confirmed.</p>
      )}
    </div>
  );
}
