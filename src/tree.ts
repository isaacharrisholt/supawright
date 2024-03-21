import { faker } from '@faker-js/faker'
import { connect, type Configuration } from 'ts-postgres'

type SchemaRow = {
  table_schema: string
  table_name: string
  column_name: string
  is_nullable: 'YES' | 'NO'
  column_default: string | null
  is_identity: 'YES' | 'NO'
  data_type: string
  foreign_table_schema: string | null
  foreign_table_name: string | null
  foreign_column_name: string | null
  is_primary_key: boolean
  udt_schema: string
  udt_name: string
}

type Table = {
  name: string
  schema: string
  requiredColumns: Record<string, string | { schema: string; name: string }>
  foreignKeys: Record<
    string,
    { table: Table; foreignColumnName: string | null; nullable: boolean }
  >
  primaryKeys: string[]
}

export type Tables = Record<string, Record<string, Table>>
export type Enum = {
  name: string
  schema: string
  values: string[]
}
export type EnumValues = Record<string, Record<string, Enum>>

async function getClient(config?: Configuration) {
  return await connect({
    host: 'localhost',
    port: 54322,
    user: 'postgres',
    database: 'postgres',
    password: 'postgres',
    ...config
  })
}

export async function getEnums(schemas: string[], config?: Configuration) {
  const client = await getClient(config)

  const schemasString = schemas.map((s) => `'${s}'`).join(', ')

  const enums = [
    ...(await client.query<{
      schema_name: string
      enum_name: string
      enum_value: string
    }>(`
        select
            n.nspname as schema_name,
            t.typname as enum_name,
            e.enumlabel as enum_value
        from pg_type as t
            left join pg_enum as e
                on t.oid = e.enumtypid
            left join pg_catalog.pg_namespace as n
                on n.oid = t.typnamespace
        where n.nspname in (${schemasString})
            and e.enumlabel is not null
`))
  ]

  await client.end()

  const enumValues: EnumValues = {}

  for (const row of enums) {
    if (!enumValues[row.schema_name]) {
      enumValues[row.schema_name] = {}
    }
    if (!enumValues[row.schema_name][row.enum_name]) {
      enumValues[row.schema_name][row.enum_name] = {
        name: row.enum_name,
        schema: row.schema_name,
        values: []
      }
    }

    enumValues[row.schema_name][row.enum_name].values.push(row.enum_value)
  }

  return enumValues
}

export async function getSchemaTree(schemas: string[], config?: Configuration) {
  const client = await getClient(config)

  const schemasString = schemas.map((s) => `'${s}'`).join(', ')
  const results = await client.query<SchemaRow>(`
        with foreign_keys as (
            select
                tc.table_name, 
                kcu.column_name, 
                tc.constraint_type = 'PRIMARY KEY' as is_primary_key,
                -- Only show foreign key information for foreign keys
                -- Otherwise, we'll get duplicate rows for primary keys
                case
                  when tc.constraint_type = 'FOREIGN KEY'
                    then ccu.table_schema 
                end as foreign_table_schema,
                case
                  when tc.constraint_type = 'FOREIGN KEY'
                    then ccu.table_name 
                end as foreign_table_name,
                case
                  when tc.constraint_type = 'FOREIGN KEY'
                    then ccu.column_name 
                end as foreign_column_name
            from information_schema.table_constraints as tc 
                left join information_schema.key_column_usage as kcu
                    on tc.constraint_name = kcu.constraint_name
                left join information_schema.constraint_column_usage as ccu
                    on ccu.constraint_name = tc.constraint_name
            where tc.constraint_type in ('FOREIGN KEY', 'PRIMARY KEY') and tc.table_schema in (${schemasString})
        )

        select
            cols.table_schema,
            cols.table_name,
            cols.column_name,
            cols.is_nullable,
            cols.column_default,
            cols.is_identity,
            cols.data_type,
            fk.foreign_table_schema,
            fk.foreign_table_name,
            fk.foreign_column_name,
            fk.is_primary_key,
            cols.udt_schema,
            cols.udt_name,
            null as enum_values
        from information_schema.columns as cols
        left join foreign_keys as fk
            on cols.table_name = fk.table_name
                and cols.column_name = fk.column_name
        where cols.table_schema in (${schemasString})
    `)

  await client.end()

  // Convert to objects to make them easier to work with
  const rows = [...results].filter((row) => {
    // We only care about the column if it's not nullable
    // and has no default value or it's a foreign/primary key
    const hasDefault = !!row.column_default || row.is_identity === 'YES'
    if (
      !!row.foreign_table_schema ||
      row.is_primary_key ||
      (row.is_nullable === 'NO' && !hasDefault)
    ) {
      return true
    }

    return false
  })

  const tables: Tables = {}

  for (const row of rows) {
    if (!tables[row.table_schema]) {
      tables[row.table_schema] = {}
    }
    if (!tables[row.table_schema][row.table_name]) {
      tables[row.table_schema][row.table_name] = {
        name: row.table_name,
        schema: row.table_schema,
        requiredColumns: {},
        foreignKeys: {},
        primaryKeys: []
      }
    }

    if (row.foreign_table_schema && row.foreign_table_name) {
      if (!tables[row.foreign_table_schema]) {
        tables[row.foreign_table_schema] = {}
      }
      if (!tables[row.foreign_table_schema][row.foreign_table_name]) {
        tables[row.foreign_table_schema][row.foreign_table_name] = {
          name: row.foreign_table_name,
          schema: row.foreign_table_schema,
          requiredColumns: {},
          foreignKeys: {},
          primaryKeys: []
        }
      }
      tables[row.table_schema][row.table_name].foreignKeys[row.column_name] = {
        table: tables[row.foreign_table_schema][row.foreign_table_name],
        foreignColumnName: row.foreign_column_name,
        nullable: row.is_nullable === 'YES'
      }
    }

    const hasDefault = row.column_default || row.is_identity === 'YES'
    if (row.is_nullable === 'NO' && !hasDefault) {
      tables[row.table_schema][row.table_name].requiredColumns[row.column_name] =
        row.data_type === 'USER-DEFINED'
          ? { schema: row.udt_schema, name: row.udt_name }
          : row.data_type
    }

    if (
      row.is_primary_key &&
      !tables[row.table_schema][row.table_name].primaryKeys.includes(row.column_name)
    ) {
      tables[row.table_schema][row.table_name].primaryKeys.push(row.column_name)
    }
  }

  return tables
}

function randint() {
  return Math.floor(Math.random() * 1000)
}

function randfloat() {
  return Math.random() * 1000
}

function randstring() {
  return faker.lorem.word() + String(new Date().valueOf())
}

export const fakeDataGenerators = {
  integer: randint,
  bigint: randint,
  smallint: randint,
  decimal: randfloat,
  numeric: randfloat,
  real: randfloat,
  double: randfloat,
  'double precision': randfloat,
  money: randfloat,
  character: randstring,
  varchar: randstring,
  text: randstring,
  bytea: randstring,
  'character varying': randstring,
  timestamp: () => new Date().toISOString(),
  'timestamp with time zone': () => new Date().toISOString(),
  'timestamp without time zone': () => new Date().toISOString(),
  date: () => new Date().toISOString(),
  time: () => new Date().toISOString(),
  'time with time zone': () => new Date().toISOString(),
  'time without time zone': () => new Date().toISOString(),
  interval: () => new Date().toISOString(),
  boolean: () => faker.datatype.boolean(),
  uuid: () => faker.string.uuid(),
  json: () => ({}),
  jsonb: () => ({}),
  ARRAY: () => []
} as const
