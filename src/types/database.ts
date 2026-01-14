/**
 * Database type definitions for Lyrtrip
 * These types correspond to tables in the Supabase database
 */

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  destination?: string;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  trip_id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  date_planned?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Playlist {
  id: string;
  trip_id: string;
  title: string;
  description?: string;
  artist_count?: number;
  song_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  playlist_id: string;
  title: string;
  artist: string;
  duration?: number;
  spotify_id?: string;
  added_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Tour {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  artist?: string;
  start_date: string;
  end_date: string;
  total_stops?: number;
  budget?: number;
  status: 'planning' | 'in-progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface TourStop {
  id: string;
  tour_id: string;
  venue_name: string;
  city: string;
  country: string;
  date: string;
  ticket_url?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}
