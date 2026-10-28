// Service-role Supabase client. Server only: bypasses row level security.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { config, secret } from "../env";

let client: SupabaseClient<Database> | undefined;

export function supabaseConfigured(): boolean {
  const c = config();
  return Boolean(c.NEXT_PUBLIC_SUPABASE_URL && c.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseAdmin(): SupabaseClient<Database> {
  client ??= createClient<Database>(secret("NEXT_PUBLIC_SUPABASE_URL"), secret("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
