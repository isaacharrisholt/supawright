import { test } from '@playwright/test'
import type {
  Page,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType
} from '@playwright/test'
import { type SupawrightOptions, Supawright } from './harness'
import type { GenericDatabase, SchemaOf } from './types'

type ExtensionOptions<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> = {
  beforeTeardown?: (params: {
    supawright: Supawright<Database, Schema>
    page: Page
  }) => Promise<void>
}

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
  options?: SupawrightOptions<Database, Schema> & ExtensionOptions<Database, Schema>
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
    supawright: async ({ page }, use) => {
      const { beforeTeardown, ...supawrightOptions } = options ?? {}
      const supawright = await Supawright.new(schemas, supawrightOptions)
      await use(supawright)
      if (beforeTeardown) {
        await beforeTeardown({ supawright, page })
      }
      await supawright.teardown()
    }
  })
}
