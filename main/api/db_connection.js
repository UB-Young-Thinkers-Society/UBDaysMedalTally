// This file is ONLY for your API (server-side)
// It uses the SERVICE_ROLE_KEY to bypass RLS for admin tasks.
// NEVER expose this file or key to the client.

import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase project settings
const SUPABASE_URL = "https://nmftggrzxxkvpepqywmm.supabase.co";
// !! IMPORTANT !! This is your 'service_role' key, NOT the 'anon' key.
// Store this in Vercel Environment Variables, not in the code.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY environment variable');
}

// Create a single, reusable server-side client
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);