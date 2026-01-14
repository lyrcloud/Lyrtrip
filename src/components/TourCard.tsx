'use client';

import { Tour } from '@/types/database';
import Link from 'next/link';

interface TourCardProps {
  tour: Tour;
  onDelete?: (id: string) => void;
}

/**
 * TourCard component displays a single tour in card format
 */
export default function TourCard({ tour, onDelete }: TourCardProps) {
  const statusColors = {
    planning: 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
  };

  const formattedStart = new Date(tour.start_date).toLocaleDateString();
  const formattedEnd = new Date(tour.end_date).toLocaleDateString();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{tour.title}</h3>
          {tour.artist && (
            <p className="text-sm text-gray-600 mt-1">{tour.artist}</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[tour.status]}`}>
          {tour.status}
        </span>
      </div>

      {tour.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {tour.description}
        </p>
      )}

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div>
          {formattedStart} to {formattedEnd}
        </div>
        {tour.total_stops && (
          <div>{tour.total_stops} stops</div>
        )}
      </div>

      {tour.budget && (
        <div className="text-sm font-medium text-gray-700 mb-4">
          Budget: ${tour.budget.toLocaleString()}
        </div>
      )}

      <div className="flex gap-2">
        <Link
          href={`/tours/${tour.id}`}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 text-center"
        >
          View Details
        </Link>
        {onDelete && (
          <button
            onClick={() => onDelete(tour.id)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
