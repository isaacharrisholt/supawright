import { expect } from '@playwright/test'
import { withSupawright } from '../src'
import type { Database } from './database'

const test = withSupawright<Database, 'public'>(['public'])

test('can create table with no dependencies', async ({ supawright }) => {
  await supawright.create('create_recursive_parent_1')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_recursive_parent_1')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
})

test('required foreign key dependencies are automatically created', async ({
  supawright
}) => {
  await supawright.create('create_recursive_child_1')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_recursive_child_1')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].id ?? null).not.toBeNull()
  expect(data?.[0].required_foreign_key ?? null).not.toBeNull()

  const { data: parents } = await supawright
    .supabase('public')
    .from('create_recursive_parent_1')
    .select()
  expect(parents?.length).toBe(1)
})

test('optional foreign key dependencies are left null', async ({ supawright }) => {
  await supawright.create('create_recursive_child_1')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_recursive_child_1')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].optional_foreign_key).toBeNull()

  const { data: parents } = await supawright
    .supabase('public')
    .from('create_recursive_parent_2')
    .select()
  expect(parents?.length).toBe(0)
})

test('can create table with multiple dependencies', async ({ supawright }) => {
  await supawright.create('create_recursive_child_2')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_recursive_child_2')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].required_foreign_key_1 ?? null).not.toBeNull()
  expect(data?.[0].required_foreign_key_2 ?? null).not.toBeNull()

  const { data: parent1 } = await supawright
    .supabase('public')
    .from('create_recursive_parent_1')
    .select()
  expect(parent1?.length).toBe(1)

  const { data: parent2 } = await supawright
    .supabase('public')
    .from('create_recursive_parent_2')
    .select()
  expect(parent2?.length).toBe(1)
})

test('grandparent dependencies are created', async ({ supawright }) => {
  await supawright.create('create_recursive_grandchild_1')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_recursive_grandchild_1')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].required_foreign_key ?? null).not.toBeNull()

  const { data: parent } = await supawright
    .supabase('public')
    .from('create_recursive_child_1')
    .select()
  expect(parent?.length).toBe(1)

  const { data: grandparent } = await supawright
    .supabase('public')
    .from('create_recursive_parent_1')
    .select()
  expect(grandparent?.length).toBe(1)
})

test('dependencies are not created if passed in', async ({ supawright }) => {
  const parent = await supawright.create('create_recursive_parent_1')
  await supawright.create('create_recursive_child_1', {
    required_foreign_key: parent.id
  })

  const { data, error } = await supawright
    .supabase('public')
    .from('create_recursive_child_1')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].id).toBeTruthy()

  const { data: parents } = await supawright
    .supabase('public')
    .from('create_recursive_parent_1')
    .select()
  expect(parents?.length).toBe(1)
  expect(parents?.[0].id).toBe(parent.id)
})

test('dependency fixtures are reused', async ({ supawright }) => {
  await supawright.create('create_recursive_grandchild_2')

  const { data, error } = await supawright
    .supabase('public')
    .from('create_recursive_grandchild_2')
    .select()
  expect(error).toBeNull()
  expect(data?.length).toBe(1)
  expect(data?.[0].required_foreign_key_1).toBeTruthy()
  expect(data?.[0].required_foreign_key_2).toBeTruthy()

  const { data: grandparent } = await supawright
    .supabase('public')
    .from('create_recursive_parent_1')
    .select()
  expect(grandparent?.length).toBe(1)
  expect(data?.[0].required_foreign_key_1).toBe(grandparent?.[0].id)

  const { data: parent } = await supawright
    .supabase('public')
    .from('create_recursive_child_1')
    .select()
  expect(parent?.length).toBe(1)
  expect(data?.[0].required_foreign_key_2).toBe(parent?.[0].id)
  expect(parent?.[0].required_foreign_key).toBe(grandparent?.[0].id)

  // This is implicit, but testing explicitly to make it clear
  // that the grandparent fixture is reused
  expect(parent?.[0].required_foreign_key).toBe(data?.[0].required_foreign_key_1)
})

test('auth users are recursively created', async ({ supawright }) => {
  const record = await supawright.create('create_recursive_requires_auth_user')

  const { data: userFetch, error } = await supawright
    .supabase('public')
    .auth.admin.getUserById(record.user_id)
  expect(error).toBeNull()
  expect(userFetch.user).toBeTruthy()
})
