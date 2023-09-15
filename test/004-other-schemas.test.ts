import { expect } from '@playwright/test'
import { withSupawright } from '../src'
import { Database } from './database'

const test = withSupawright<Database, 'public' | 'other'>(['public', 'other'])

test('can create in non-public schemas', async ({ supawright }) => {
  const record = await supawright.create('other', 'other_schemas_parent')
  expect(record).toBeTruthy()
})

test('can recursively create in non-public schemas', async ({ supawright }) => {
  const record = await supawright.create('other', 'other_schemas_local_child')
  expect(record.parent_id).toBeTruthy()
})

test('can create parent records across schema boundaries', async ({ supawright }) => {
  await supawright.create('public', 'other_schemas_foreign_child')

  const { data: parents, error } = await supawright
    .supabase('other')
    .from('other_schemas_parent')
    .select()

  expect(error).toBeNull()
  expect(parents?.length).toBe(1)
})

test('can discover child records across schema boundaries', async ({ supawright }) => {
  const parent = await supawright.create('other', 'other_schemas_parent')

  const { error: childSelectError } = await supawright
    .supabase()
    .from('other_schemas_foreign_child')
    .select()
    .eq('parent_id', parent.id)

    expect(childSelectError).toBeNull()

  await supawright.teardown()

  const { data, error } = await supawright
    .supabase()
    .from('other_schemas_foreign_child')
    .select()

  expect(error).toBeNull()
  expect(data?.length).toBe(0)
})