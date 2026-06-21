'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface GroceryItem {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  emoji: string;
  category: string;
  inStock: boolean;
  popular?: boolean;
}

interface CartEntry {
  item: GroceryItem;
  quantity: number;
}

interface OrderDraft {
  items: CartEntry[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
}

const groceryItems: GroceryItem[] = [
  // Produce
  { id: 'g1', name: 'Organic Avocados', description: 'Ripe and ready, pack of 4', price: 6.99, unit: 'pack', emoji: '🥑', category: 'Produce', inStock: true, popular: true },
  { id: 'g2', name: 'Baby Spinach', description: 'Fresh organic spinach, 5 oz', price: 3.49, unit: 'bag', emoji: '🥬', category: 'Produce', inStock: true },
  { id: 'g3', name: 'Cherry Tomatoes', description: 'Sweet and juicy, 1 pint', price: 4.29, unit: 'pint', emoji: '🍅', category: 'Produce', inStock: true, popular: true },
  { id: 'g4', name: 'Bananas', description: 'Organic, bunch of 6', price: 1.99, unit: 'bunch', emoji: '🍌', category: 'Produce', inStock: true },
  { id: 'g5', name: 'Blueberries', description: 'Fresh picked, 6 oz', price: 5.49, unit: 'pint', emoji: '🫐', category: 'Produce', inStock: true },
  // Dairy & Eggs
  { id: 'g6', name: 'Whole Milk', description: 'Organic, 1 gallon', price: 6.49, unit: 'gallon', emoji: '🥛', category: 'Dairy', inStock: true, popular: true },
  { id: 'g7', name: 'Free-Range Eggs', description: 'Large, dozen', price: 5.99, unit: 'dozen', emoji: '🥚', category: 'Dairy', inStock: true, popular: true },
  { id: 'g8', name: 'Greek Yogurt', description: 'Plain, 32 oz', price: 7.29, unit: 'tub', emoji: '🍦', category: 'Dairy', inStock: true },
  { id: 'g9', name: 'Cheddar Cheese', description: 'Sharp, sliced, 8 oz', price: 4.99, unit: 'pack', emoji: '🧀', category: 'Dairy', inStock: true },
  // Bakery
  { id: 'g10', name: 'Sourdough Bread', description: 'Freshly baked, whole loaf', price: 8.99, unit: 'loaf', emoji: '🍞', category: 'Bakery', inStock: true, popular: true },
  { id: 'g11', name: 'Croissants', description: 'Butter, pack of 4', price: 6.49, unit: 'pack', emoji: '🥐', category: 'Bakery', inStock: true },
  { id: 'g12', name: 'Bagels', description: 'Everything, 6-pack', price: 4.99, unit: 'pack', emoji: '🥯', category: 'Bakery', inStock: false },
  // Proteins
  { id: 'g13', name: 'Salmon Fillet', description: 'Atlantic, 1 lb', price: 14.99, unit: 'lb', emoji: '🐟', category: 'Proteins', inStock: true, popular: true },
  { id: 'g14', name: 'Chicken Breast', description: 'Boneless skinless, 2 lbs', price: 11.49, unit: 'pack', emoji: '🍗', category: 'Proteins', inStock: true },
  { id: 'g15', name: 'Ground Beef', description: 'Lean 90/10, 1 lb', price: 8.99, unit: 'lb', emoji: '🥩', category: 'Proteins', inStock: true },
  // Pantry
  { id: 'g16', name: 'Olive Oil', description: 'Extra virgin, 500ml', price: 9.99, unit: 'bottle', emoji: '🫒', category: 'Pantry', inStock: true },
  { id: 'g17', name: 'Pasta', description: 'Penne, 1 lb', price: 2.49, unit: 'box', emoji: '🍝', category: 'Pantry', inStock: true },
  { id: 'g18', name: 'Canned Tomatoes', description: 'San Marzano, 28 oz', price: 3.99, unit: 'can', emoji: '🥫', category: 'Pantry', inStock: true },
  // Beverages
  { id: 'g19', name: 'Orange Juice', description: 'Freshly squeezed, 52 oz', price: 7.99, unit: 'bottle', emoji: '🍊', category: 'Beverages', inStock: true, popular: true },
  { id: 'g20', name: 'Sparkling Water', description: 'Unflavored, 12-pack', price: 9.49, unit: 'pack', emoji: '💧', category: 'Beverages', inStock: true },
];

const categories = ['All', 'Produce', 'Dairy', 'Bakery', 'Proteins', 'Pantry', 'Beverages'];

export default function GroceryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const filtered = groceryItems.filter(item => {
    const matchSearch = search === '' || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || item.category === category;
    return matchSearch && matchCat;
  });

  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const getQty = (id: string) => cart.find(c => c.item.id === id)?.quantity ?? 0;

  const addItem = (item: GroceryItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item, quantity: 1 }];
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
    const subtotal = cartTotal;
    const deliveryFee = subtotal >= 35 ? 0 : 3.99;
    const serviceFee = Math.max(1, Math.round(subtotal * 0.05));
    setOrderDraft({ items: cart, subtotal, deliveryFee, serviceFee, total: subtotal + deliveryFee + serviceFee });
    setShowCart(false);
  };

  const confirmOrder = async () => {
    if (!orderDraft || !customerName.trim() || !deliveryAddress.trim()) return;
    if (!user) { router.push('/login'); return; }

    setOrderLoading(true);
    setOrderError(null);
    const itemsSummary = orderDraft.items.map(c => `${c.quantity}× ${c.item.name}`).join(', ');
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_STRIPE_LAMBDA_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName: 'Lyrtrip Grocery Order',
          address: deliveryAddress.trim(),
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 transition">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <h1 className="text-xl font-bold text-gray-900">Grocery</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="text-xs text-green-600 font-medium hidden sm:block">Free delivery over $35</p>
            {cartCount > 0 && (
              <button
                onClick={() => setShowCart(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#06C167] text-white font-semibold rounded-full hover:bg-green-600 transition"
              >
                🛒 {cartCount} · ${cartTotal.toFixed(2)}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl mb-4">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search grocery items…"
            className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
          />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">✕</button>}
        </div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                category === c
                  ? 'bg-[#06C167] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#06C167]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Items grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(item => {
            const qty = getQty(item.id);
            return (
              <div key={item.id} className={`bg-white rounded-2xl border overflow-hidden transition ${item.inStock ? 'border-gray-200 hover:shadow-md' : 'border-gray-100 opacity-60'}`}>
                <div className="h-28 bg-green-50 flex items-center justify-center text-5xl">
                  {item.emoji}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</p>
                    {item.popular && <span className="text-xs text-[#06C167] font-medium shrink-0">Popular</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="font-bold text-gray-900">${item.price.toFixed(2)}</p>
                    {item.inStock ? (
                      <div className="flex items-center gap-1">
                        {qty > 0 ? (
                          <>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs font-bold transition"
                            >−</button>
                            <span className="text-xs font-bold w-4 text-center">{qty}</span>
                          </>
                        ) : null}
                        <button
                          onClick={() => addItem(item)}
                          className="w-6 h-6 rounded-full bg-[#06C167] hover:bg-green-600 text-white flex items-center justify-center text-xs font-bold transition"
                        >+</button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">Out of stock</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🛒</p>
            <p className="font-medium">No items found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        )}
      </div>

      {/* Cart slide-up */}
      {showCart && cart.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {cart.map(c => (
                <div key={c.item.id} className="flex items-center gap-3">
                  <span className="text-2xl">{c.item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{c.item.name}</p>
                    <p className="text-xs text-gray-500">${c.item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => removeItem(c.item.id)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold transition">−</button>
                    <span className="text-sm font-bold w-4 text-center">{c.quantity}</span>
                    <button onClick={() => addItem(c.item)} className="w-7 h-7 rounded-full bg-[#06C167] hover:bg-green-600 text-white flex items-center justify-center font-bold transition">+</button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-12 text-right">${(c.item.price * c.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              {cartTotal < 35 && (
                <p className="text-xs text-green-600 text-center mb-3 font-medium">
                  Add ${(35 - cartTotal).toFixed(2)} more for free delivery!
                </p>
              )}
              <button
                onClick={buildOrder}
                className="w-full py-3 bg-[#06C167] text-white font-bold rounded-xl hover:bg-green-600 transition"
              >
                Checkout · ${cartTotal.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order modal */}
      {orderDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Complete Your Order</h2>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal ({cartCount} items)</span><span>${orderDraft.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Delivery fee</span><span>{orderDraft.deliveryFee === 0 ? '🎉 Free' : `$${orderDraft.deliveryFee.toFixed(2)}`}</span></div>
              <div className="flex justify-between text-gray-600"><span>Service fee</span><span>${orderDraft.serviceFee.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
                <span>Total</span><span>${orderDraft.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C167]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery address</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Street address, city, zip"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C167]"
                />
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
                disabled={!customerName.trim() || !deliveryAddress.trim() || orderLoading}
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
