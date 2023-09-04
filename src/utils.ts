import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { GenericDatabase, SchemaOf, SupabaseClientCredentials } from './types'

export function createSupabaseTestClient<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
>(
  credentials: SupabaseClientCredentials,
  schema?: Schema
): SupabaseClient<Database, Schema> {
  if (!process.env.PUBLIC_SUPABASE_URL) {
    throw Error('PUBLIC_SUPABASE_URL is not set')
  }
  if (!process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY) {
    throw Error('PRIVATE_SUPABASE_SERVICE_ROLE_KEY is not set')
  }
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
