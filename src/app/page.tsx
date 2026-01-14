import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Header with Logo */}
        <div className="flex items-center justify-between mb-20">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
              LT
            </div>
            <span className="text-2xl font-bold text-gray-900">Lyrtrip</span>
          </Link>
          <nav className="flex gap-6">
            <Link href="/tours" className="text-gray-600 hover:text-gray-900 font-medium">
              Tours
            </Link>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Sign In
            </button>
          </nav>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to Lyrtrip
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Plan your music tours, organize venues, manage playlists, and create unforgettable musical experiences.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-8 md:grid-cols-3 mb-16">
          {/* Tours Card */}
          <Link href="/tours" className="group">
            <div className="rounded-lg bg-white p-8 shadow-md hover:shadow-xl transition-shadow cursor-pointer h-full">
              <div className="mb-4 w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-2xl">
                🎤
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Manage Tours</h3>
              <p className="text-gray-600">
                Create and manage your music tours with stops, dates, budgets, and artist details.
              </p>
              <div className="mt-4 text-indigo-600 font-medium group-hover:text-indigo-700">
                Explore Tours →
              </div>
            </div>
          </Link>

          {/* Venues Card */}
          <div className="rounded-lg bg-white p-8 shadow-md hover:shadow-xl transition-shadow cursor-pointer h-full">
            <div className="mb-4 w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-2xl">
              📍
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Venue Planning</h3>
            <p className="text-gray-600">
              Track venues, locations, ticket URLs, and performance notes for each stop.
            </p>
            <div className="mt-4 text-purple-600 font-medium">
              Coming Soon
            </div>
          </div>

          {/* Playlists Card */}
          <div className="rounded-lg bg-white p-8 shadow-md hover:shadow-xl transition-shadow cursor-pointer h-full">
            <div className="mb-4 w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center text-2xl">
              🎵
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Music Playlists</h3>
            <p className="text-gray-600">
              Organize songs and playlists for each tour, with artist and duration tracking.
            </p>
            <div className="mt-4 text-pink-600 font-medium">
              Coming Soon
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Plan Your Tour?</h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            Start creating your first tour today and take control of your music journey.
          </p>
          <Link
            href="/tours/new"
            className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            Create Your First Tour
          </Link>
        </div>

        {/* Footer Stats */}
        <div className="mt-16 grid gap-4 md:grid-cols-3 text-center">
          <div>
            <div className="text-4xl font-bold text-gray-900">∞</div>
            <p className="text-gray-600 mt-2">Tours You Can Plan</p>
          </div>
          <div>
            <div className="text-4xl font-bold text-gray-900">🌍</div>
            <p className="text-gray-600 mt-2">Global Reach</p>
          </div>
          <div>
            <div className="text-4xl font-bold text-gray-900">🎵</div>
            <p className="text-gray-600 mt-2">Music First</p>
          </div>
        </div>
      </main>
    </div>
  );
}
