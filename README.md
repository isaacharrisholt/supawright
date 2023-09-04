# Supawright

Supawright is a Playwright test harness for E2E testing with Supabase.

## Installation

```bash
pnpm i -D supawright
```

## Usage

### Setup

Unfortunately, Supabase's generated TypeScript types generate an interface,
whereas for type constraints, we need a type. So, first change the following
line in your generated Supabase types (typically `database.ts`):

```diff
- export interface Database {
+ export type Database = {
```

Then, create a test file, e.g. `can-login.test.ts`, and create a test function
with the `supawright` function:

```ts
import { supawright } from 'supawright'
import type { Database } from './database'

const test = supawright<
  Database,
  'public' | 'other' // Note 1
>(['public', 'other'])
```

Unfortunately, I haven't found a nice way of infering the schema names from the
first argument, so you'll have to specify the schemas you'd like the harness to
use in two places.

### Tests

Assuming you have a `test` function as above, you can now write tests and use
the `harness` fixture to recursively create database tables. Consider the
following table structure:

```sql
create table public."user" (
    id uuid primary key default uuid_generate_v4(),
    email text not null unique,
    password text not null
);

create table public.session (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.users(id),
    token text,
    created_at timestamp with time zone not null default now()
);
```

If you use the harness to create a `session`, it will automatically create a
`user` for you, and you can access the `user`'s `id` in the `session`'s
`user_id` column. The harness will also automatically generate fake data for
any columns that are not nullable and do not have a default value.

```ts
test('can login', async ({ harness }) => {
  const session = await harness.create('public', 'session')
  expect(session.user_id).toBeDefined()
})
```

When the test exits, the harness will automatically clean up all the records
it has created, and will inspect foreign key constraints to delete records in
the correct order.

It will also discover any additional records in the database that were not
created by the harness, and will delete them as well, provided they have a
foreign key relationship with a record that was created by the harness.

This runs recursively. Consider the following example:

```ts
test('can login', async ({ harness }) => {
  const user = await harness.create('public', 'user')

  // Since we're using the standard Supabase client here, the
  // harness is unaware of the records we're creating.
  await harness
    .supabase()
    .from('session')
    .insert([{ user_id: user.id }, { user_id: user.id }])

  // However, the harness will discover these records and delete
  // them when the test exits.
})
```

### Overrides

If you have custom functions you wish to use to generate fake data or create
records, you can pass optional config as the second argument to the `supawright`
function.

The `generators` object is a record of Postgres types to functions that return
a value of that type. The harness will use these functions to generate fake
data for any columns that are not nullable and do not have a default value.

If you're using user defined types, specify the `USER-DEFINED` type name in
the `generators` object. This will be used for enums, for example.

The `overrides` object is a record of schema names to a record of table names
to functions that return a record of column names to values. The harness will
use these functions to create records in the database. These return an array
of `Fixtures` which Supawright will use to record the records it has created.

This is useful if you use a database trigger to populate certain tables and
need to run custom code to activate the trigger.

```ts
const test = supawright<
    Database,
    'public' | 'other',
>(
    ['public', 'other'],
    {
        generators: {
            smallint: () => 123,
            text: (table: string, column: string) => `${table}.${column}`,
        },
        overrides: {
            public: {
                user: async ({ harness, data, supabase, generators }) => {
                    const { data: user } = await supabase
                        .from('user')
                        .insert(...)
                        .select()
                        .single()
                    ...
                    return [{
                        schema: 'public',
                        table: 'user',
                        data: user,
                    }]
                }
            }
        }
    }
)
```

### Connection details

By default, Supawright will look for the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
environment variables to connect to your Supabase instance. You can override
these using the `supabase` key in the config object.

Supawright also needs access to a Supabase database for schema inspection, and will
use the default Supabase localhost database. If you'd like to override this, provide
a `database` key in the config object.

```ts
const test = supawright<Database, 'public' | 'other'>(['public', 'other'], {
  supabase: {
    supabaseUrl: 'my-supabase-url.com',
    serviceRoleKey: 'my-service-role-key'
  },
  database: {
    host: 'localhost',
    port: 5432,
    user: 'me',
    password: 'password',
    database: 'my-database'
  }
})
```

## TODO

- [ ] Automatically infer allowed enum values from database
- [ ] Automatically infer custom composite types from database
- [ ] Fix up my janky typings
- [ ] Come up with a way of using the `Database` type without having to modify
      the generated Supabase types
  - This may involve convincing Supabase to change up their generated types
