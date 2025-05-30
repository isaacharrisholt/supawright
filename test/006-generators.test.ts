import { expect } from '@playwright/test'
import { withSupawright } from '../src'
import type { Database } from './database'

const test = withSupawright<Database, 'public'>(['public'], {
  generators: {
    text: () => 'overridden',
    bigint: () => null
  }
})

test('can override generation with a generator', async ({ supawright }) => {
  const record = await supawright.create('public', 'generators')
  expect(record.name).toBe('overridden')
})

test('generators will fall back to default generators', async ({ supawright }) => {
  const record = await supawright.create('public', 'generators')
  expect(record.age).not.toBe(null)
})
