'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { listTours } from '@/lib/api';
import TourCard from '@/components/TourCard';
import type { Tour } from '@/types/database';

function initialsFor(name?: string, email?: string) {
  if (name) {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return email?.[0]?.toUpperCase() || '?';
}

const providerLabel: Record<string, string> = {
  Google: 'Signed in with Google',
  Facebook: 'Signed in with Facebook',
  WeChat: 'Signed in with WeChat',
  cognito: 'Signed in with email',
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tours, setTours] = useState<Tour[]>([]);
  const [toursLoading, setToursLoading] = useState(true);
  const [toursError, setToursError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    listTours()
      .then(res => setTours(res.tours))
      .catch(err => setToursError((err as Error).message || 'Could not load tours.'))
      .finally(() => setToursLoading(false));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  const upcoming = tours.filter(t => t.status !== 'completed').length;
  const completed = tours.filter(t => t.status === 'completed').length;

  const stats = [
    { label: 'Total tours', value: tours.length },
    { label: 'Upcoming', value: upcoming },
    { label: 'Completed', value: completed },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile header */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-4">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.picture}
                alt=""
                className="w-16 h-16 rounded-full object-cover border-2 border-white/40"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/15 border-2 border-white/40 text-white text-xl font-semibold flex items-center justify-center">
                {initialsFor(user.name, user.email)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome back{user.name ? `, ${user.name}` : ''}!
              </h1>
              <p className="text-indigo-100 text-sm mt-1">
                {user.email || providerLabel[user.provider || 'cognito']}
              </p>
              <span className="inline-block mt-2 text-xs font-medium bg-white/15 text-white rounded-full px-3 py-1">
                {providerLabel[user.provider || 'cognito']}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map(stat => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-5"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/tours/new"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            + Plan a new tour
          </Link>
          <Link
            href="/tours"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            View all tours
          </Link>
        </div>

        {/* Recent tours */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent tours</h2>
            {tours.length > 0 && (
              <Link href="/tours" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            )}
          </div>

          {toursLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-44 rounded-lg border border-gray-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : toursError ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <p className="text-gray-600">{toursError}</p>
            </div>
          ) : tours.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tours.slice(0, 3).map(tour => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900">No tours yet</h3>
              <p className="mt-2 text-gray-600">Get started by creating your first tour</p>
              <Link
                href="/tours/new"
                className="mt-4 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
              >
                Create tour
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
