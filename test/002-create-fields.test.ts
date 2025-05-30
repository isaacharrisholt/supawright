import { expect } from '@playwright/test'
import { withSupawright } from '../src'
import type { Database } from './database'

const test = withSupawright<Database, 'public'>(['public'])

test('required columns are automatically created', async ({ supawright }) => {
  await supawright.create('create_fields')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_fields')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].id).toBeTruthy()
  expect(data?.[0].required_column).toBeTruthy()
})

test('optional columns are left null', async ({ supawright }) => {
  await supawright.create('create_fields')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_fields')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].optional_column).toBeNull()
})

test('columns with default values use the default value', async ({ supawright }) => {
  await supawright.create('create_fields')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_fields')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].default_column).toBe('this is a default value')
})

test('field values can be passed into the create function', async ({ supawright }) => {
  await supawright.create('create_fields', {
    required_column: ['this is a required column'],
    optional_column: 'this is an optional column'
  })

  const { data, error } = await supawright
    .supabase('public')
    .from('create_fields')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].required_column).toStrictEqual(['this is a required column'])
  expect(data?.[0].optional_column).toBe('this is an optional column')
})
