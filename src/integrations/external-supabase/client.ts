import { createClient } from '@supabase/supabase-js';

// Projet Supabase externe fourni par l'utilisateur.
// L'URL et la clé anon sont publiques par nature (protégées par RLS).
const SUPABASE_URL = 'https://cribugpeujhoxnozectf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyaWJ1Z3BldWpob3hub3plY3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDk4NjcsImV4cCI6MjEwMTE4NTg2N30.E2SzvdEJnBt24rq-5FO1V7fEqKkYf743ISC4qN-8dpY';

export const externalSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'sb-external-auth-token',
  },
});
