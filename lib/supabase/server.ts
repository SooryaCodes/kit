// Service-role Supabase client. Server only: bypasses row level security.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, secret } from "../env";

if (typeof window !== "undefined") {
  throw new Error("lib/supabase/server must not be imported from client code");
}

let client: SupabaseClient | undefined;

export function supabaseConfigured(): boolean {
  const c = config();
  return Boolean(c.NEXT_PUBLIC_SUPABASE_URL && c.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseAdmin(): SupabaseClient {
  client ??= createClient(secret("NEXT_PUBLIC_SUPABASE_URL"), secret("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
