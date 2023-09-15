import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { GenericDatabase, SchemaOf, SupabaseClientCredentials } from './types'

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
  debug(...args: any[]) {
    process.env.TEST_DEBUG && console.log(...args)
  },

  error(...args: any[]) {
    console.error(...args)
  }
}
