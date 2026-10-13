'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface PickupPlace {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  rating: number;
  reviewCount: number;
  readyIn: string;
  distance: string;
  imageEmoji: string;
  priceLevel: string;
  items: PickupItem[];
}

interface PickupItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  prepTime: string;
  popular?: boolean;
}

interface CartItem {
  item: PickupItem;
  place: PickupPlace;
  quantity: number;
}

interface OrderDraft {
  items: CartItem[];
  place: PickupPlace;
  subtotal: number;
  serviceFee: number;
  total: number;
}

const pickupPlaces: PickupPlace[] = [
  {
    id: 'p1',
    name: 'The Coffee Corner',
    cuisine: 'Café',
    description: 'Specialty coffee, pastries, and light bites — ready in minutes',
    rating: 4.8,
    reviewCount: 520,
    readyIn: '5–10 min',
    distance: '0.2 mi',
    imageEmoji: '☕',
    priceLevel: '$',
    items: [
      { id: 'pi1', name: 'Flat White', description: 'Double ristretto, steamed whole milk', price: 5.50, emoji: '☕', prepTime: '3 min', popular: true },
      { id: 'pi2', name: 'Almond Croissant', description: 'Flaky pastry, almond cream, toasted almonds', price: 4.50, emoji: '🥐', prepTime: '1 min', popular: true },
      { id: 'pi3', name: 'Açaí Bowl', description: 'Frozen açaí, granola, fresh berries', price: 12, emoji: '🫐', prepTime: '5 min' },
      { id: 'pi4', name: 'Cold Brew', description: '12-hour cold brew over ice', price: 5, emoji: '🧊', prepTime: '1 min' },
    ],
  },
  {
    id: 'p2',
    name: 'Taco Loco',
    cuisine: 'Mexican',
    description: 'Street tacos, burritos, and quesadillas made to order, fast',
    rating: 4.6,
    reviewCount: 1100,
    readyIn: '10–15 min',
    distance: '0.5 mi',
    imageEmoji: '🌮',
    priceLevel: '$',
    items: [
      { id: 'pi5', name: 'Al Pastor Tacos (3)', description: 'Pork, pineapple, cilantro, salsa verde', price: 12, emoji: '🌮', prepTime: '8 min', popular: true },
      { id: 'pi6', name: 'Carne Asada Burrito', description: 'Grilled beef, rice, beans, guac, pico', price: 15, emoji: '🌯', prepTime: '10 min', popular: true },
      { id: 'pi7', name: 'Chips & Guacamole', description: 'Fresh-made guac, warm tortilla chips', price: 7, emoji: '🥑', prepTime: '3 min' },
      { id: 'pi8', name: 'Horchata', description: 'Traditional rice milk, cinnamon', price: 4, emoji: '🥤', prepTime: '1 min' },
    ],
  },
  {
    id: 'p3',
    name: 'Poke Paradise',
    cuisine: 'Hawaiian',
    description: 'Build-your-own poke bowls with sushi-grade fish and fresh toppings',
    rating: 4.7,
    reviewCount: 740,
    readyIn: '8–12 min',
    distance: '0.8 mi',
    imageEmoji: '🐟',
    priceLevel: '$$',
    items: [
      { id: 'pi9', name: 'Signature Ahi Bowl', description: 'Ahi tuna, sushi rice, edamame, avocado, ponzu', price: 17, emoji: '🍱', prepTime: '8 min', popular: true },
      { id: 'pi10', name: 'Salmon Poke Bowl', description: 'Salmon, brown rice, mango, cucumber, sesame', price: 18, emoji: '🐟', prepTime: '8 min', popular: true },
      { id: 'pi11', name: 'Veggie Bowl', description: 'Tofu, quinoa, roasted beets, tahini dressing', price: 15, emoji: '🥗', prepTime: '8 min' },
      { id: 'pi12', name: 'Miso Soup', description: 'Dashi broth, tofu, seaweed, scallions', price: 4, emoji: '🍜', prepTime: '2 min' },
    ],
  },
  {
    id: 'p4',
    name: 'Crust & Crumble — Bakery',
    cuisine: 'Bakery',
    description: 'Artisan bread, pastries, and sandwiches baked fresh daily',
    rating: 4.9,
    reviewCount: 320,
    readyIn: '5–8 min',
    distance: '0.3 mi',
    imageEmoji: '🥖',
    priceLevel: '$',
    items: [
      { id: 'pi13', name: 'Turkey Avocado Sandwich', description: 'House bread, turkey, avocado, arugula, dijon', price: 13, emoji: '🥪', prepTime: '5 min', popular: true },
      { id: 'pi14', name: 'Chocolate Croissant', description: 'Laminated dough, dark chocolate filling', price: 4, emoji: '🍫', prepTime: '1 min', popular: true },
      { id: 'pi15', name: 'Sourdough Loaf', description: '100% sourdough, wood-fired', price: 9, emoji: '🍞', prepTime: '1 min' },
      { id: 'pi16', name: 'Lemon Tart', description: 'Shortcrust pastry, lemon curd, meringue', price: 6, emoji: '🍋', prepTime: '1 min' },
    ],
  },
  {
    id: 'p5',
    name: 'Noodle House',
    cuisine: 'Asian',
    description: 'Ramen, udon, and soba noodles — comfort food you can pick up fast',
    rating: 4.5,
    reviewCount: 860,
    readyIn: '12–18 min',
    distance: '1.1 mi',
    imageEmoji: '🍜',
    priceLevel: '$$',
    items: [
      { id: 'pi17', name: 'Spicy Tonkotsu Ramen', description: 'Pork broth, chashu, egg, nori', price: 18, emoji: '🍜', prepTime: '12 min', popular: true },
      { id: 'pi18', name: 'Beef Udon', description: 'Thick udon noodles, dashi broth, wagyu beef', price: 21, emoji: '🥣', prepTime: '12 min', popular: true },
      { id: 'pi19', name: 'Gyoza (6 pcs)', description: 'Pan-fried pork and cabbage dumplings', price: 9, emoji: '🥟', prepTime: '8 min' },
      { id: 'pi20', name: 'Matcha Latte', description: 'Ceremonial grade matcha, oat milk', price: 6, emoji: '🍵', prepTime: '3 min' },
    ],
  },
];

export default function PickupPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [expandedPlace, setExpandedPlace] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [pickupTime, setPickupTime] = useState('ASAP');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const filtered = pickupPlaces.filter(p =>
    search === '' ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.cuisine.toLowerCase().includes(search.toLowerCase())
  );

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const getQty = (id: string) => cart.find(c => c.item.id === id)?.quantity ?? 0;

  const addItem = (place: PickupPlace, item: PickupItem) => {
    if (cart.length > 0 && cart[0].place.id !== place.id) {
      if (!confirm(`Replace cart from ${cart[0].place.name}?`)) return;
      setCart([{ item, place, quantity: 1 }]);
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item, place, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === id);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(c => c.item.id !== id);
      return prev.map(c => c.item.id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const buildOrder = () => {
    if (cart.length === 0) return;
    const place = cart[0].place;
    const subtotal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
    const serviceFee = Math.max(1, Math.round(subtotal * 0.06));
    setOrderDraft({ items: cart, place, subtotal, serviceFee, total: subtotal + serviceFee });
  };

  const confirmOrder = async () => {
    if (!orderDraft || !customerName.trim()) return;
    if (!user) { router.push('/login'); return; }

    setOrderLoading(true);
    setOrderError(null);
    const itemsSummary = orderDraft.items.map(c => `${c.quantity}× ${c.item.name}`).join(', ');
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_STRIPE_LAMBDA_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName: `${orderDraft.place.name} — Pickup Order`,
          address: `Pickup ${pickupTime === 'ASAP' ? 'ASAP' : `at ${pickupTime}`} from ${orderDraft.place.name} (${orderDraft.place.distance} away)`,
          checkin: new Date().toISOString().split('T')[0],
          checkout: new Date().toISOString().split('T')[0],
          guests: 1,
          guestName: customerName.trim(),
          nights: 1,
          totalPrice: orderDraft.total,
          orderDetails: itemsSummary,
        }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setOrderError(data.error ?? 'Payment failed. Please try again.');
    } catch {
      setOrderError('Could not connect to payment service.');
    } finally {
      setOrderLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 transition">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍱</span>
            <h1 className="text-xl font-bold text-gray-900">Pickup</h1>
          </div>
          <div className="ml-auto">
            {cartCount > 0 && (
              <button
                onClick={buildOrder}
                className="flex items-center gap-2 px-4 py-2 bg-[#06C167] text-white font-semibold rounded-full hover:bg-green-600 transition"
              >
                🛒 {cartCount} item{cartCount > 1 ? 's' : ''} · ${cart.reduce((s, c) => s + c.item.price * c.quantity, 0).toFixed(2)}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Banner */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <p className="font-semibold text-green-800 text-sm">Skip the wait — order ahead!</p>
            <p className="text-green-700 text-xs mt-0.5">Your order will be ready when you arrive. No delivery fee.</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl mb-6">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search places or cuisine…"
            className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
          />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">✕</button>}
        </div>

        {/* Place list */}
        <div className="space-y-4">
          {filtered.map(place => (
            <div key={place.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpandedPlace(expandedPlace === place.id ? null : place.id)}
              >
                <div className="w-20 h-20 bg-orange-50 rounded-xl flex items-center justify-center text-4xl shrink-0">
                  {place.imageEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900">{place.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{place.cuisine}</p>
                    </div>
                    <span className="text-gray-400 shrink-0">{expandedPlace === place.id ? '▲' : '▼'}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">{place.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>⭐ {place.rating} ({place.reviewCount.toLocaleString()})</span>
                    <span>·</span>
                    <span className="text-green-600 font-medium">⚡ Ready in {place.readyIn}</span>
                    <span>·</span>
                    <span>📍 {place.distance}</span>
                    <span>·</span>
                    <span>{place.priceLevel}</span>
                  </div>
                </div>
              </div>

              {expandedPlace === place.id && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-3">Menu</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {place.items.map(item => {
                      const qty = getQty(item.id);
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <span className="text-2xl shrink-0">{item.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                              {item.popular && <span className="text-xs text-[#06C167] font-medium">Popular</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm font-bold text-gray-900">${item.price.toFixed(2)}</p>
                              <span className="text-xs text-gray-400">· ready in {item.prepTime}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {qty > 0 ? (
                              <>
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-bold transition"
                                >−</button>
                                <span className="text-sm font-bold w-4 text-center">{qty}</span>
                              </>
                            ) : null}
                            <button
                              onClick={() => addItem(place, item)}
                              className="w-7 h-7 rounded-full bg-[#06C167] hover:bg-green-600 text-white flex items-center justify-center text-sm font-bold transition"
                            >+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🍱</p>
              <p className="font-medium">No pickup places found</p>
              <p className="text-sm mt-1">Try a different search</p>
            </div>
          )}
        </div>
      </div>

      {/* Order modal */}
      {orderDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Pickup Order</h2>
            <p className="text-sm text-gray-500 mb-4">{orderDraft.place.name} · {orderDraft.place.readyIn}</p>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2 text-sm">
              {orderDraft.items.map(c => (
                <div key={c.item.id} className="flex justify-between">
                  <span className="text-gray-700">{c.quantity}× {c.item.name}</span>
                  <span className="font-medium">${(c.item.price * c.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>${orderDraft.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Pickup (no delivery fee)</span><span className="text-green-600 font-medium">Free</span></div>
                <div className="flex justify-between text-gray-600"><span>Service fee</span><span>${orderDraft.serviceFee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                  <span>Total</span><span>${orderDraft.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Name for your order"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C167]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup time</label>
                <select
                  value={pickupTime}
                  onChange={e => setPickupTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C167] bg-white"
                >
                  <option value="ASAP">ASAP ({orderDraft.place.readyIn})</option>
                  <option value="15 min">In 15 minutes</option>
                  <option value="30 min">In 30 minutes</option>
                  <option value="1 hour">In 1 hour</option>
                </select>
              </div>
            </div>

            {orderError && <p className="text-red-500 text-sm mb-3">{orderError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setOrderDraft(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              >Cancel</button>
              <button
                onClick={confirmOrder}
                disabled={!customerName.trim() || orderLoading}
                className="flex-1 py-2 bg-[#06C167] text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 transition"
              >
                {orderLoading ? 'Processing…' : user ? 'Pay via Stripe →' : 'Sign in to Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
