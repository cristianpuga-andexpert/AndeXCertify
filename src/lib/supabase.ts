import { createClient } from '@supabase/supabase-js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// In DEV mode Supabase is not required — use placeholder values so createClient
// doesn't throw. The client is never actually called in DEV mode.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || (DEV_MODE ? 'https://dev-placeholder.supabase.co' : '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || (DEV_MODE ? 'dev-placeholder-key' : '');

if (!DEV_MODE && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const logOut = () => supabase.auth.signOut();
