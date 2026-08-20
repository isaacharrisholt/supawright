import { expect } from '@playwright/test'
import { withSupawright } from '../src'
import type { Database } from './database'
import { faker } from '@faker-js/faker'

const test = withSupawright<Database, 'public'>(['public'])

test('can successfully teardown single table records', async ({ supawright }) => {
  const record = await supawright.create('teardown_parent')

  await supawright.teardown()

  const { data, error } = await supawright
    .supabase('public')
    .from('teardown_parent')
    .select()
    .eq('id', record.id)
  expect(error).toBeNull()
  expect(data?.length).toBe(0)
})

test('can successfully discover dependent records', async ({ supawright }) => {
  const parent = await supawright.create('teardown_parent')
  const { data: child, error: childInsertError } = await supawright
    .supabase('public')
    .from('teardown_child')
    .insert({
      id: faker.string.uuid(),
      parent_id: parent.id
    })
    .select()
    .single()
  expect(childInsertError).toBeNull()
  if (!child) {
    throw new Error('Child record not found')
  }

  await supawright.teardown()

  const { data, error } = await supawright
    .supabase('public')
    .from('teardown_child')
    .select()
    .eq('id', child.id)
  expect(error).toBeNull()
  expect(data?.length).toBe(0)
})

test('discovers recursive dependent records once', async ({ supawright }) => {
  const parent = await supawright.create('teardown_parent')
  const children = Array.from({ length: 5 }, () => ({
    id: faker.string.uuid(),
    parent_id: parent.id
  }))
  const grandchildren = children.map((child) => ({
    child_id: child.id,
    id: faker.string.uuid()
  }))
  const supabase = supawright.supabase('public')

  const { error: childInsertError } = await supabase
    .from('teardown_child')
    .insert(children)
  expect(childInsertError).toBeNull()
  const { error: grandchildInsertError } = await supabase
    .from('teardown_grandchild')
    .insert(grandchildren)
  expect(grandchildInsertError).toBeNull()

  await supawright.discoverRecords()

  expect(supawright.fixtures('public', 'teardown_child')).toHaveLength(5)
  expect(supawright.fixtures('public', 'teardown_grandchild')).toHaveLength(5)

  await supawright.teardown()

  const [{ data: remainingChildren }, { data: remainingGrandchildren }] =
    await Promise.all([
      supabase.from('teardown_child').select('id').eq('parent_id', parent.id),
      supabase
        .from('teardown_grandchild')
        .select('id')
        .in(
          'id',
          grandchildren.map((grandchild) => grandchild.id)
        )
    ])
  expect(remainingChildren).toHaveLength(0)
  expect(remainingGrandchildren).toHaveLength(0)
})

test('can successfully teardown an auth user', async ({ supawright }) => {
  const user = await supawright.createUser()

  await supawright.teardown()

  const { data: foundUser, error } = await supawright
    .supabase('public')
    .auth.admin.getUserById(user.id)
  expect(foundUser.user).toBeNull()
  expect(error?.status).toBe(404)
})

test('can successfully discover dependents of auth users', async ({ supawright }) => {
  const user = await supawright.createUser()

  const { error: childInsertError } = await supawright
    .supabase('public')
    .from('teardown_auth_dependent')
    .insert({
      user_id: user.id
    })
    .select()
    .single()

  expect(childInsertError).toBeNull()

  await supawright.teardown()

  const { data, error } = await supawright
    .supabase('public')
    .from('teardown_auth_dependent')
    .select()

  expect(error).toBeNull()
  expect(data?.length).toBe(0)
})
