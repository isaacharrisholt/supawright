import { test } from '@playwright/test'
import { HarnessOptions, TestHarness } from './harness'
import { GenericDatabase, SchemaOf } from './types'

/**
 * Factory for a test extension that provides a test harness
 * @param schemas Schemas you'd like the test harness to use
 * @param options Options for the test harness
 * @returns A test extension that provides a test harness
 */
export function supawright<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
>(schemas: [Schema, ...Schema[]], options?: HarnessOptions<Database, Schema>) {
  return test.extend<{
    harness: TestHarness<Database, Schema>
  }>({
    harness: async ({}, use) => {
      const harness = await TestHarness.new(schemas, options)
      await use(harness)
      await harness.teardown()
    }
  })
}
