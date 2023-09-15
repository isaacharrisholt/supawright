import { test } from '@playwright/test'
import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType
} from '@playwright/test'
import { SupawrightOptions, Supawright } from './harness'
import { GenericDatabase, SchemaOf } from './types'

/**
 * Factory for a test extension that provides a Supawright harness
 * @param schemas Schemas you'd like Supawright to use
 * @param options Options for Supawright
 * @returns A test extension that provides a Supawright harness
 */
export function withSupawright<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
>(
  schemas: [Schema, ...Schema[]],
  options?: SupawrightOptions<Database, Schema>
): TestType<
  PlaywrightTestArgs &
    PlaywrightTestOptions & {
      supawright: Supawright<Database, Schema>
    },
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
> {
  return test.extend<{
    supawright: Supawright<Database, Schema>
  }>({
    supawright: async ({}, use) => {
      const supawright = await Supawright.new(schemas, options)
      await use(supawright)
      await supawright.teardown()
    }
  })
}
