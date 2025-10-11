// db_connection.js
const SUPABASE_URL = "https://nmftggrzxxkvpepqywmm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZnRnZ3J6eHhrdnBlcHF5d21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNDkzNzYsImV4cCI6MjA3NTcyNTM3Nn0.Y-BXGIQ0r_HqLZAvU8RSpZwOa3Rtvvjlp0xzbeARTto";

// Create a single reusable Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
