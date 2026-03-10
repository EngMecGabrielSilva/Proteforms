import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

// For backward compatibility if needed, but we should migrate to getSupabase()
// However, many components might already use the exported 'supabase'
// We can use a Proxy to handle lazy initialization if we want to keep the same API
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop, receiver) => {
    const client = getSupabase();
    return Reflect.get(client, prop, receiver);
  }
});

