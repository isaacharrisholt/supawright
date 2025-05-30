import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { GenericDatabase, SchemaOf, SupabaseClientCredentials } from './types'

export function createSupabaseTestClient<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
>(
  credentials: SupabaseClientCredentials,
  schema?: Schema
): SupabaseClient<Database, Schema> {
  return createClient(credentials.supabaseUrl, credentials.serviceRoleKey, {
    db: { schema },
    auth: { persistSession: false }
  })
}

export const log = {
  debug(...args: unknown[]) {
    process.env.TEST_DEBUG && console.log(...args)
  },

  error(...args: unknown[]) {
    console.error(...args)
  }
}
