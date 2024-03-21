import type { GenericSchema } from '@supabase/supabase-js/dist/module/lib/types'

export type GenericDatabase = Record<string, GenericSchema>

export type SchemaOf<Database extends GenericDatabase> = string & keyof Database

export type TableIn<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> = string & keyof Database[Schema]['Tables']

export type Select<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>,
  Table extends TableIn<Database, Schema>
> = Database[Schema]['Tables'][Table]['Row']

export type Insert<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>,
  Table extends TableIn<Database, Schema>
> = Database[Schema]['Tables'][Table]['Insert']

export type Fixture<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>,
  Table extends TableIn<Database, Schema>
> = {
  schema: string
  table: Table
  data: Select<Database, Schema, Table>
}

export type DependencyGraph<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> = Record<
  `${Schema}.${TableIn<Database, Schema>}`,
  Partial<
    Record<
      `${Schema}.${TableIn<Database, Schema>}`,
      {
        column: keyof Select<Database, Schema, TableIn<Database, Schema>>
        references: keyof Select<Database, Schema, TableIn<Database, Schema>> | null
      }[]
    >
  >
>

type SomePostgresType =
  | 'integer'
  | 'bigint'
  | 'smallint'
  | 'decimal'
  | 'numeric'
  | 'real'
  | 'double'
  | 'double precision'
  | 'money'
  | 'character'
  | 'varchar'
  | 'text'
  | 'bytea'
  | 'character varying'
  | 'timestamp'
  | 'timestamp with time zone'
  | 'timestamp without time zone'
  | 'date'
  | 'time'
  | 'time with time zone'
  | 'time without time zone'
  | 'interval'
  | 'boolean'
  | 'uuid'
  | 'json'
  | 'jsonb'
  | 'ARRAY'
  | 'USER-DEFINED'

export type PostgresType = SomePostgresType | (Omit<string, SomePostgresType> & string)

export type SupabaseClientCredentials = {
  supabaseUrl: string
  serviceRoleKey: string
}
