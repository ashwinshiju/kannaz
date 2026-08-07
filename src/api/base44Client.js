import { createClient } from '@staticbot/base44-supabase-shim';

//Create a client with authentication required
export const base44 = createClient({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  schemaPrefix: 'public'
});
