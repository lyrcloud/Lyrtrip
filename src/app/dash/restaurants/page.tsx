'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  imageEmoji: string;
  priceLevel: string;
  featured?: boolean;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  popular?: boolean;
}

interface CartItem {
  menuItem: MenuItem;
  restaurant: Restaurant;
  quantity: number;
}

interface OrderDraft {
  items: CartItem[];
  restaurant: Restaurant;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
}

const restaurants: Restaurant[] = [
  {
    id: '1',
    name: 'Mama Mia — Italian Kitchen',
    cuisine: 'Italian',
    description: 'Authentic pizza, pasta, and risotto crafted with imported ingredients',
    rating: 4.8,
    reviewCount: 1240,
    deliveryTime: '30–45 min',
    deliveryFee: 2.99,
    minOrder: 15,
    imageEmoji: '🍕',
    priceLevel: '$$',
    featured: true,
    items: [
      { id: 'i1', name: 'Margherita Pizza', description: 'San Marzano tomato, fresh mozzarella, basil', price: 18, emoji: '🍕', popular: true },
      { id: 'i2', name: 'Truffle Pasta', description: 'Tagliatelle, black truffle, parmesan', price: 22, emoji: '🍝', popular: true },
      { id: 'i3', name: 'Tiramisu', description: 'Classic Italian dessert with espresso and mascarpone', price: 9, emoji: '🍮' },
      { id: 'i4', name: 'Caprese Salad', description: 'Heirloom tomatoes, burrata, aged balsamic', price: 14, emoji: '🥗' },
    ],
  },
  {
    id: '2',
    name: 'Dragon Palace — Asian Fusion',
    cuisine: 'Asian Fusion',
    description: 'Chinese, Thai, and Vietnamese flavors in one vibrant menu',
    rating: 4.6,
    reviewCount: 890,
    deliveryTime: '25–40 min',
    deliveryFee: 1.99,
    minOrder: 12,
    imageEmoji: '🥢',
    priceLevel: '$$',
    items: [
      { id: 'i5', name: 'Dim Sum Basket (6 pcs)', description: 'Har gow, siu mai, char siu bao', price: 16, emoji: '🥟', popular: true },
      { id: 'i6', name: 'Pad Thai', description: 'Rice noodles, shrimp, peanuts, tamarind sauce', price: 19, emoji: '🍜', popular: true },
      { id: 'i7', name: 'Pho Bo', description: 'Rich beef broth, rice noodles, herbs', price: 17, emoji: '🍲' },
      { id: 'i8', name: 'Mango Sticky Rice', description: 'Thai dessert with coconut cream', price: 8, emoji: '🥭' },
    ],
  },
  {
    id: '3',
    name: 'Burger & Fries Heaven',
    cuisine: 'American',
    description: 'Gourmet smash burgers, hand-cut fries, and craft shakes',
    rating: 4.5,
    reviewCount: 2100,
    deliveryTime: '20–35 min',
    deliveryFee: 0,
    minOrder: 10,
    imageEmoji: '🍔',
    priceLevel: '$',
    featured: true,
    items: [
      { id: 'i9', name: 'Smash Burger', description: 'Double patty, American cheese, special sauce', price: 15, emoji: '🍔', popular: true },
      { id: 'i10', name: 'Truffle Fries', description: 'Hand-cut fries, truffle oil, parmesan', price: 9, emoji: '🍟', popular: true },
      { id: 'i11', name: 'Vanilla Milkshake', description: 'Thick and creamy, real vanilla bean', price: 7, emoji: '🥤' },
      { id: 'i12', name: 'Onion Rings', description: 'Beer-battered, crispy, served with aioli', price: 8, emoji: '🧅' },
    ],
  },
  {
    id: '4',
    name: 'Spice Garden — Indian',
    cuisine: 'Indian',
    description: 'Authentic North and South Indian cuisine with freshly ground spices',
    rating: 4.7,
    reviewCount: 654,
    deliveryTime: '35–50 min',
    deliveryFee: 2.49,
    minOrder: 18,
    imageEmoji: '🍛',
    priceLevel: '$$',
    items: [
      { id: 'i13', name: 'Butter Chicken', description: 'Tender chicken in rich tomato-cream sauce', price: 21, emoji: '🍛', popular: true },
      { id: 'i14', name: 'Garlic Naan (3 pcs)', description: 'Freshly baked, brushed with garlic butter', price: 6, emoji: '🫓', popular: true },
      { id: 'i15', name: 'Biryani', description: 'Fragrant basmati rice with saffron and spices', price: 23, emoji: '🍚' },
      { id: 'i16', name: 'Mango Lassi', description: 'Chilled yogurt drink with Alphonso mango', price: 5, emoji: '🥭' },
    ],
  },
  {
    id: '5',
    name: 'Sushi Zen',
    cuisine: 'Japanese',
    description: 'Premium sushi rolls, sashimi, and ramen from a master chef',
    rating: 4.9,
    reviewCount: 430,
    deliveryTime: '40–55 min',
    deliveryFee: 3.99,
    minOrder: 25,
    imageEmoji: '🍱',
    priceLevel: '$$$',
    items: [
      { id: 'i17', name: 'Dragon Roll (8 pcs)', description: 'Shrimp tempura, avocado, tobiko', price: 18, emoji: '🍣', popular: true },
      { id: 'i18', name: 'Tuna Sashimi (6 pcs)', description: 'Premium bluefin, fresh wasabi', price: 24, emoji: '🐟', popular: true },
      { id: 'i19', name: 'Tonkotsu Ramen', description: 'Rich pork broth, chashu, soft-boiled egg', price: 20, emoji: '🍜' },
      { id: 'i20', name: 'Mochi Ice Cream (3 pcs)', description: 'Matcha, strawberry, mango', price: 9, emoji: '🍡' },
    ],
  },
  {
    id: '6',
    name: 'Green Bowl — Vegan',
    cuisine: 'Vegan',
    description: 'Plant-based bowls, wraps, and smoothies packed with nutrients',
    rating: 4.4,
    reviewCount: 310,
    deliveryTime: '20–30 min',
    deliveryFee: 1.49,
    minOrder: 12,
    imageEmoji: '🥑',
    priceLevel: '$',
    items: [
      { id: 'i21', name: 'Buddha Bowl', description: 'Quinoa, roasted veggies, tahini dressing', price: 16, emoji: '🥗', popular: true },
      { id: 'i22', name: 'Avocado Toast', description: 'Sourdough, smashed avo, microgreens', price: 13, emoji: '🥑', popular: true },
      { id: 'i23', name: 'Green Smoothie', description: 'Spinach, banana, almond milk, chia seeds', price: 8, emoji: '🥤' },
      { id: 'i24', name: 'Falafel Wrap', description: 'Crispy falafel, hummus, pickled veggies', price: 14, emoji: '🌯' },
    ],
  },
];

const cuisineFilters = ['All', 'Italian', 'Asian Fusion', 'American', 'Indian', 'Japanese', 'Vegan'];

export default function RestaurantsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState('All');
  const [expandedRestaurant, setExpandedRestaurant] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const filtered = restaurants.filter(r => {
    const matchSearch = search === '' ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine.toLowerCase().includes(search.toLowerCase());
    const matchCuisine = cuisineFilter === 'All' || r.cuisine === cuisineFilter;
    return matchSearch && matchCuisine;
  });

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const addToCart = (restaurant: Restaurant, item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, restaurant, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(c => c.menuItem.id !== itemId);
      return prev.map(c => c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const getQuantity = (itemId: string) => cart.find(c => c.menuItem.id === itemId)?.quantity ?? 0;

  const buildOrder = () => {
    if (cart.length === 0) return;
    const restaurant = cart[0].restaurant;
    const subtotal = cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0);
    const deliveryFee = restaurant.deliveryFee;
    const serviceFee = Math.max(1, Math.round(subtotal * 0.08));
    setOrderDraft({ items: cart, restaurant, subtotal, deliveryFee, serviceFee, total: subtotal + deliveryFee + serviceFee });
  };

  const confirmOrder = async () => {
    if (!orderDraft || !customerName.trim() || !deliveryAddress.trim()) return;
    if (!user) { router.push('/login'); return; }

    setOrderLoading(true);
    setOrderError(null);
    const itemsSummary = orderDraft.items.map(c => `${c.quantity}× ${c.menuItem.name}`).join(', ');
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_STRIPE_LAMBDA_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName: `${orderDraft.restaurant.name} — Food Order`,
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
    <div className="flex-1 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 transition">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <h1 className="text-xl font-bold text-gray-900">Restaurants</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {cartCount > 0 && (
              <button
                onClick={buildOrder}
                className="flex items-center gap-2 px-4 py-2 bg-[#06C167] text-white font-semibold rounded-full hover:bg-green-600 transition"
              >
                🛒 {cartCount} item{cartCount > 1 ? 's' : ''} · ${cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0).toFixed(2)}
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
            placeholder="Search restaurants or cuisine…"
            className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        {/* Cuisine filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {cuisineFilters.map(c => (
            <button
              key={c}
              onClick={() => setCuisineFilter(c)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                cuisineFilter === c
                  ? 'bg-[#06C167] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#06C167]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Restaurant list */}
        <div className="space-y-4">
          {filtered.map(restaurant => (
            <div key={restaurant.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition">
              {/* Restaurant card header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpandedRestaurant(expandedRestaurant === restaurant.id ? null : restaurant.id)}
              >
                <div className="w-20 h-20 bg-orange-50 rounded-xl flex items-center justify-center text-4xl shrink-0">
                  {restaurant.imageEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{restaurant.name}</h3>
                        {restaurant.featured && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">Featured</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{restaurant.cuisine}</p>
                    </div>
                    <span className="text-gray-400 shrink-0">{expandedRestaurant === restaurant.id ? '▲' : '▼'}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">{restaurant.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>⭐ {restaurant.rating} ({restaurant.reviewCount.toLocaleString()})</span>
                    <span>·</span>
                    <span>🕐 {restaurant.deliveryTime}</span>
                    <span>·</span>
                    <span>{restaurant.deliveryFee === 0 ? '🆓 Free delivery' : `$${restaurant.deliveryFee} delivery`}</span>
                    <span>·</span>
                    <span>{restaurant.priceLevel}</span>
                  </div>
                </div>
              </div>

              {/* Menu items (expanded) */}
              {expandedRestaurant === restaurant.id && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-3">Menu</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {restaurant.items.map(item => {
                      const qty = getQuantity(item.id);
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <span className="text-2xl shrink-0">{item.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                              {item.popular && <span className="text-xs text-[#06C167] font-medium">Popular</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                            <p className="text-sm font-bold text-gray-900 mt-1">${item.price}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {qty > 0 ? (
                              <>
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-bold transition"
                                >−</button>
                                <span className="text-sm font-bold w-4 text-center">{qty}</span>
                              </>
                            ) : null}
                            <button
                              onClick={() => addToCart(restaurant, item)}
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
              <p className="text-4xl mb-3">🍽️</p>
              <p className="font-medium">No restaurants found</p>
              <p className="text-sm mt-1">Try a different search or filter</p>
            </div>
          )}
        </div>
      </div>

      {/* Order modal */}
      {orderDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Your Order</h2>
            <p className="text-sm text-gray-500 mb-4">{orderDraft.restaurant.name}</p>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
              {orderDraft.items.map(c => (
                <div key={c.menuItem.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{c.quantity}× {c.menuItem.name}</span>
                  <span className="font-medium">${(c.menuItem.price * c.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>${orderDraft.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery fee</span><span>{orderDraft.deliveryFee === 0 ? 'Free' : `$${orderDraft.deliveryFee.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Service fee</span><span>${orderDraft.serviceFee.toFixed(2)}</span>
                </div>
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
