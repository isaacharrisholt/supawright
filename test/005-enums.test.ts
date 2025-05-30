import { expect } from '@playwright/test'
import { withSupawright } from '../src'
import type { Database } from './database'

const test = withSupawright<Database, 'public'>(['public'])

test('can correctly set enum values when required', async ({ supawright }) => {
  const record = await supawright.create('public', 'enum_table')
  expect(record.enum_column).toBeNull()
  expect(record.required_enum_column).not.toBeNull()
})
