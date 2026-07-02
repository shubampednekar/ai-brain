import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';

export type { Database, Json } from './types.js';
export type TypedSupabaseClient = SupabaseClient<Database>;

export function createSupabaseClient(
  url: string,
  key: string,
  options?: { auth?: { persistSession?: boolean; autoRefreshToken?: boolean } },
): TypedSupabaseClient {
  return createClient<Database>(url, key, {
    auth: {
      persistSession: options?.auth?.persistSession ?? true,
      autoRefreshToken: options?.auth?.autoRefreshToken ?? true,
    },
  });
}

export function createServiceClient(url: string, serviceRoleKey: string): TypedSupabaseClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
