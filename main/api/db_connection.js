// This file is ONLY for your API (server-side)
// It uses the SERVICE_ROLE_KEY to bypass RLS for admin tasks.
// NEVER expose this file or key to the client.

import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase project settings
const SUPABASE_URL = "https://nmftggrzxxkvpepqywmm.supabase.co";
// !! IMPORTANT !! This is your 'service_role' key, NOT the 'anon' key.
// Store this in Vercel Environment Variables, not in the code.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY 
  || process.env.SUPABASE_URL_SUPABASE_SERVICE_ROLE_KEY 
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZnRnZ3J6eHhrdnBlcHF5d21tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE0OTM3NiwiZXhwIjoyMDc1NzI1Mzc2fQ.POYv0FsBFk-7ucKzpFBZ2XcclOluUup-z1ilWqKkdk0";

// Create a single, reusable server-side client
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);