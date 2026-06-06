import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const personalUserId = import.meta.env.VITE_PERSONAL_USER_ID;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && personalUserId);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
