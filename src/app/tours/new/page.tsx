import Link from 'next/link';
import TourForm from '@/components/TourForm';

/**
 * Create new tour page
 */
export default function NewTourPage() {
  const handleSubmit = async (data: any) => {
    // TODO: Implement Supabase integration to save tour
    console.log('Saving new tour:', data);
    // After successful save, redirect to tours page
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/tours"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            ← Back to Tours
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Create New Tour</h1>
          <p className="mt-2 text-gray-600">Plan your next music tour adventure</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-sm">
          <TourForm onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
