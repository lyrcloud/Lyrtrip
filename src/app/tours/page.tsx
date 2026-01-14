import Link from 'next/link';
import TourCard from '@/components/TourCard';

/**
 * Tours page - displays all tours for the user
 */
export default function ToursPage() {
  // Mock data - replace with actual data fetching from Supabase
  const tours = [
    {
      id: '1',
      user_id: 'user-1',
      title: 'Summer World Tour 2026',
      artist: 'The Rolling Stones',
      description: 'An epic journey across 5 continents',
      start_date: '2026-06-01',
      end_date: '2026-12-31',
      total_stops: 45,
      budget: 500000,
      status: 'planning' as const,
      created_at: '2026-01-13',
      updated_at: '2026-01-13',
    },
    {
      id: '2',
      user_id: 'user-1',
      title: 'European Festival Circuit',
      artist: 'Dua Lipa',
      description: 'Hit the biggest music festivals across Europe',
      start_date: '2026-05-01',
      end_date: '2026-09-30',
      total_stops: 25,
      budget: 250000,
      status: 'in-progress' as const,
      created_at: '2026-01-10',
      updated_at: '2026-01-13',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Tours</h1>
            <p className="mt-2 text-gray-600">Plan and manage your music tours</p>
          </div>
          <Link
            href="/tours/new"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            + New Tour
          </Link>
        </div>

        {/* Tours Grid */}
        {tours.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tours.map(tour => (
              <TourCard
                key={tour.id}
                tour={tour}
                onDelete={(id) => console.log('Delete tour:', id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
            <h3 className="text-lg font-medium text-gray-900">No tours yet</h3>
            <p className="mt-2 text-gray-600">Get started by creating your first tour</p>
            <Link
              href="/tours/new"
              className="mt-4 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
            >
              Create Tour
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
