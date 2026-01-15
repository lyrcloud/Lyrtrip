import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Get the current user session
 */
export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current authenticated user
 */
export async function getUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
  });
}

/**
 * Sign in a user with email and password
 */
export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

/**
 * Sign out the current user
 */
export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Reset password for a user
 */
export async function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
}
export interface GoogleAutocompleteSuggestion {
    placePrediction?: {
        placeId: string;
    };
    mainText?: {
        text: string;
    } | string;
    secondaryText?: {
        text: string;
    } | string;
    placeId?: string;
    id?: string;
}
