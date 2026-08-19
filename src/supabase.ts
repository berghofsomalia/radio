import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://trildotfvkmqwvbeboka.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l6qAlkLTJD5eCwWO0TnNGQ_qTJX6XkR";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export function moderatorEmail(username: string) {
  return `${username.trim().toLocaleLowerCase()}@radio.invalid`;
}
