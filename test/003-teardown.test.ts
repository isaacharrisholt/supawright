import { expect } from '@playwright/test'
import { withSupawright } from '../src'
import { Database } from './database'
import { faker } from '@faker-js/faker'

const test = withSupawright<Database, 'public'>(['public'])

test('can successfully teardown single table records', async ({ supawright }) => {
  const record = await supawright.create('teardown_parent')

  await supawright.teardown()

  const { data, error } = await supawright
    .supabase()
    .from('teardown_parent')
    .select()
    .eq('id', record.id)
  expect(error).toBeNull()
  expect(data?.length).toBe(0)
})

test('can successfully teardown parent records', async ({ supawright }) => {
  const record = await supawright.create('teardown_child')

  await supawright.teardown()

  const { data, error } = await supawright
    .supabase()
    .from('teardown_parent')
    .select()
    .eq('id', record.id)
  expect(error).toBeNull()
  expect(data?.length).toBe(0)
})

test('will successfully discover dependent records', async ({ supawright }) => {
  const parent = await supawright.create('teardown_parent')
  const { data: child, error: childInsertError } = await supawright
    .supabase()
    .from('teardown_child')
    .insert({
      id: faker.string.uuid(),
      parent_id: parent.id
    })
    .select()
    .single()
  expect(childInsertError).toBeNull()

  await supawright.teardown()

  const { data, error } = await supawright
    .supabase()
    .from('teardown_child')
    .select()
    .eq('id', child!.id)
  expect(error).toBeNull()
  expect(data?.length).toBe(0)
})

test('can successfully teardown an auth user', async ({ supawright }) => {
  const user = await supawright.createUser()

  await supawright.teardown()

  const { data: foundUser, error } = await supawright.supabase().auth.admin.getUserById(user.id)
  expect(foundUser.user).toBeNull()
  expect(error?.status).toBe(404)
})