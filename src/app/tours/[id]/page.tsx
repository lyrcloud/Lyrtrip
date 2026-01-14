import Link from 'next/link';
import { notFound } from 'next/navigation';

interface TourDetailsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Tour details page - view and edit a specific tour
 */
export default async function TourDetailsPage({ params }: TourDetailsPageProps) {
  const { id } = await params;

  // Mock data - replace with actual Supabase query
  const tour = {
    id,
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
  };

  if (!tour) {
    notFound();
  }

  const stops = [
    { id: '1', venue_name: 'Madison Square Garden', city: 'New York', country: 'USA', date: '2026-06-15' },
    { id: '2', venue_name: 'The O2 Arena', city: 'London', country: 'UK', date: '2026-07-20' },
    { id: '3', venue_name: 'Estadio Santiago Bernabéu', city: 'Madrid', country: 'Spain', date: '2026-08-10' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/tours"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← Back to Tours
        </Link>

        <div className="mt-8 rounded-lg bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{tour.title}</h1>
              {tour.artist && (
                <p className="mt-2 text-lg text-gray-600">{tour.artist}</p>
              )}
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-medium ${
              tour.status === 'planning' ? 'bg-blue-100 text-blue-800' :
              tour.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {tour.status}
            </span>
          </div>

          {/* Description */}
          {tour.description && (
            <p className="mb-8 text-gray-600">{tour.description}</p>
          )}

          {/* Tour Information */}
          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-600">Start Date</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {new Date(tour.start_date).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-600">End Date</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {new Date(tour.end_date).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-600">Total Stops</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{tour.total_stops}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-600">Budget</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                ${tour.budget?.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Tour Stops */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Tour Stops</h2>
              <Link
                href={`/tours/${id}/stops/new`}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                + Add Stop
              </Link>
            </div>

            {stops.length > 0 ? (
              <div className="space-y-4">
                {stops.map((stop) => (
                  <div
                    key={stop.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">{stop.venue_name}</h3>
                      <p className="text-sm text-gray-600">
                        {stop.city}, {stop.country}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {new Date(stop.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No tour stops added yet</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 border-t pt-8">
            <Link
              href={`/tours/${id}/edit`}
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-center font-medium text-white hover:bg-indigo-700"
            >
              Edit Tour
            </Link>
            <button className="flex-1 rounded-md border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50">
              Delete Tour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
