import { faker } from '@faker-js/faker'
import { Client, type Configuration } from 'ts-postgres'

type SchemaRow = {
  schema: string
  table: string
  column: string
  nullable: boolean
  hasDefault: boolean
  type: string
  foreignTableSchema: string
  foreignTableName: string
  foreignColumnName: string
  isPrimaryKey: boolean
}

type Table = {
  name: string
  schema: string
  requiredColumns: Record<string, string>
  foreignKeys: Record<
    string,
    { table: Table; foreignColumnName: string; nullable: boolean }
  >
  primaryKeys: string[]
}

export type Tables = Record<string, Record<string, Table>>

export async function getSchemaTree(schemas: string[], config?: Configuration) {
  const client = new Client({
    host: 'localhost',
    port: 54322,
    user: 'postgres',
    database: 'postgres',
    password: 'postgres',
    ...config
  })

  await client.connect()
  const schemasString = schemas.map((s) => `'${s}'`).join(', ')
  const results = await client.query(`
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
            fk.is_primary_key
        from information_schema.columns as cols
        left join foreign_keys as fk
            on cols.table_name = fk.table_name
                and cols.column_name = fk.column_name
        where cols.table_schema in (${schemasString})
    `)

  // Convert to objects to make them easier to work with
  const rows = [...results]
    .map((result) => {
      const row = result.data
      const schemaRow: SchemaRow = {
        schema: row[0] as string,
        table: row[1] as string,
        column: row[2] as string,
        nullable: row[3] === 'YES',
        hasDefault: !!row[4] || row[5] === 'YES',
        type: row[6] as string,
        foreignTableSchema: row[7] as string,
        foreignTableName: row[8] as string,
        foreignColumnName: row[9] as string,
        isPrimaryKey: !!row[10]
      }

      // We only care about the column if it's not nullable
      // and has no default value or it's a foreign/primary key
      if (
        !!schemaRow.foreignTableSchema ||
        schemaRow.isPrimaryKey ||
        (!schemaRow.nullable && !schemaRow.hasDefault)
      ) {
        return schemaRow
      }

      return null
    })
    .filter(Boolean) as SchemaRow[]

  const tables: Tables = {}

  for (const schema of schemas) {
    for (const row of rows) {
      if (!tables[schema]) {
        tables[schema] = {}
      }
      if (!tables[schema][row.table]) {
        tables[schema][row.table] = {
          name: row.table,
          schema,
          requiredColumns: {},
          foreignKeys: {},
          primaryKeys: []
        }
      }

      if (row.foreignTableSchema) {
        if (!tables[row.foreignTableSchema]) {
          tables[row.foreignTableSchema] = {}
        }
        if (!tables[row.foreignTableSchema][row.foreignTableName]) {
          tables[row.foreignTableSchema][row.foreignTableName] = {
            name: row.foreignTableName,
            schema: row.foreignTableSchema,
            requiredColumns: {},
            foreignKeys: {},
            primaryKeys: []
          }
        }
        tables[row.schema][row.table].foreignKeys[row.column] = {
          table: tables[row.foreignTableSchema][row.foreignTableName],
          foreignColumnName: row.foreignColumnName,
          nullable: row.nullable
        }
      }

      if (!row.nullable && !row.hasDefault) {
        tables[row.schema][row.table].requiredColumns[row.column] = row.type
      }

      if (
        row.isPrimaryKey &&
        !tables[row.schema][row.table].primaryKeys.includes(row.column)
      ) {
        tables[row.schema][row.table].primaryKeys.push(row.column)
      }
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
