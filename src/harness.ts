import { faker } from '@faker-js/faker'
import type { SupabaseClient, AdminUserAttributes, User } from '@supabase/supabase-js'
import { Fixtures } from './fixtures'
import {
  type Enum,
  type EnumValues,
  type Tables,
  fakeDataGenerators,
  getEnums,
  getSchemaTree
} from './tree'
import type {
  DependencyGraph,
  Fixture,
  GenericDatabase,
  Insert,
  PostgresType,
  SchemaOf,
  Select,
  SupabaseClientCredentials,
  TableIn
} from './types'
import { createSupabaseTestClient, log } from './utils'
import type { Configuration as PostgresConfig } from 'ts-postgres'

const DEFAULT_SUPABASE_URL = 'http://localhost:54321'
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

type Generator<Database extends GenericDatabase, Schema extends SchemaOf<Database>> =
  | (() => unknown)
  // TODO: figure out better typing for `column`
  | ((table: TableIn<Database, Schema>, column: string) => unknown)

export type Generators<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> = Partial<Record<PostgresType, Generator<Database, Schema>>>

export type Creator<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>,
  Table extends TableIn<Database, Schema>
> = (params: {
  supawright: Supawright<Database, Schema>
  data: Partial<Insert<Database, Schema, Table>>
  supabase: SupabaseClient<Database, Schema>
  generators: Generators<Database, Schema>
}) => Promise<Fixture<Database, Schema | 'auth', TableIn<Database, Schema> | 'users'>[]>

export type UserCreator<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> = (params: {
  supawright: Supawright<Database, Schema>
  data: AdminUserAttributes
  supabase: SupabaseClient<Database, Schema>
  generators: Generators<Database, Schema>
}) => Promise<Fixture<Database, Schema | 'auth', TableIn<Database, Schema> | 'users'>[]>

export type SupawrightOptions<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> = {
  generators?: Generators<Database, Schema>
  overrides?: {
    [S in Schema]?: {
      [Table in TableIn<Database, S>]?: Creator<Database, Schema, Table>
    }
  } & {
    auth?: {
      users?: UserCreator<Database, Schema>
    }
  }
  supabase?: SupabaseClientCredentials
  database?: PostgresConfig
}

/**
 * Supawright class.
 *
 * This class provides public methods for creating and accessing records required
 * for testing. It also provides a teardown method which removes all records
 * created during the lifecycle of the Supawright instance.
 *
 * Note that the teardown method respects foreign key constraints, so records
 * are removed in an order which respects FK constraints.
 */
export class Supawright<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> {
  private schemas: Schema[]
  private tables: Tables
  private enums: EnumValues
  private readonly options?: SupawrightOptions<Database, Schema>
  private dependencyGraph: DependencyGraph<Database, Schema>
  private _fixtures: Fixtures<Database, Schema> = new Fixtures()

  public static async new<
    Database extends GenericDatabase,
    Schema extends SchemaOf<Database>
  >(schemas: [Schema, ...Schema[]], options?: SupawrightOptions<Database, Schema>) {
    if (!schemas.length) {
      throw new Error('No schemas provided')
    }
    const [tables, enums] = await Promise.all([
      getSchemaTree(schemas, options?.database),
      getEnums(schemas, options?.database)
    ])
    return new Supawright(schemas, tables, enums, options)
  }

  private constructor(
    schemas: Schema[],
    tables: Tables,
    enums: EnumValues,
    options?: SupawrightOptions<Database, Schema>
  ) {
    this.schemas = schemas
    this.tables = tables
    this.enums = enums
    this.options = options
    this.dependencyGraph = this.createDependencyGraph()
  }

  public record<Table extends TableIn<Database, Schema>>(
    fixture: Fixture<Database, Schema, Table>
  ) {
    this._fixtures.add(fixture)
  }

  public fixtures(): Fixture<Database, Schema, TableIn<Database, Schema>>[]
  public fixtures<S extends Schema, Table extends TableIn<Database, S>>(
    schema: S,
    table: Table
  ): Fixture<Database, Schema, Table>[]
  public fixtures<S extends Schema, Table extends TableIn<Database, S>>(
    schema?: S,
    table?: Table
  ) {
    if (!table || !schema) {
      return this._fixtures.get()
    }
    return this._fixtures.get(schema, table)
  }

  /**
   * Refreshes the current object from the database and updates the Supawright
   * instance's internal store
   * @param schema The schema name of the object to refresh
   * @param table The table name of the object to refresh
   * @param current The current object to refresh
   * @param by What column to search by
   * @returns The updated object
   */
  public async refresh<
    S extends Schema,
    Table extends TableIn<Database, S>,
    Data extends Select<Database, S, Table>
  >(schema: S, table: Table, current: Data, by: string & keyof Data): Promise<Data> {
    const supabase = this.supabase(schema)
    const { data, error } = await supabase
      .from(table)
      .select()
      .eq(by, current[by] as any)
      .single()

    if (error) {
      log?.error('Failed to refresh fixture', { error })
      throw new Error(`Failed to refresh fixture: ${error.message}`)
    }

    this._fixtures.update(
      schema,
      table,
      { schema, table, data: data as unknown as Data },
      by
    )
    return data as unknown as Data
  }

  private getRootTables() {
    return Object.entries(this.tables).flatMap(([, tables]) => {
      return Object.values(tables)
        .filter((table) => Object.keys(table.foreignKeys).length === 0)
        .map((table) => ({
          schema: table.schema as Schema,
          name: table.name as TableIn<Database, Schema>
        }))
    })
  }

  /**
   * Search the database from the root tables and discover all records
   * associated with the fixtures.
   *
   * Discovered records are recorded against the Supawright instance for
   * later use.
   */
  async discoverRecords() {
    const tablesToVisit = this.getRootTables()
    log?.debug('Starting record discovery', { tablesToVisit })
    // For each of the root tables, discover records for all dependent tables.
    while (tablesToVisit.length) {
      const rootTable = tablesToVisit.shift()

      if (!rootTable) {
        continue
      }

      const { schema: rootTableSchema, name: rootTableName } = rootTable
      log?.debug(
        `Discovering records for dependents of ${rootTableSchema}.${rootTableName}`
      )

      const dependentTables =
        this.dependencyGraph[`${rootTableSchema}.${rootTableName}`]
      const rootTableFixtures = this.fixtures(rootTableSchema, rootTableName)
      for (const [dependentTable, dependencies] of Object.entries(dependentTables)) {
        const [dependentTableSchema, dependentTableName] = dependentTable.split(
          '.'
        ) as [Schema, TableIn<Database, Schema>]
        const supabase = this.supabase(dependentTableSchema)
        let query = supabase.from(dependentTableName).select()

        const filterString = (dependencies as { column: string; references: string }[])
          .map((dependency) => {
            return `${dependency.column}.in.(${rootTableFixtures
              .map(
                (fixture) =>
                  fixture.data[dependency.references as keyof typeof fixture.data]
              )
              .join(',')})`
          })
          .join(', ')

        if (filterString) {
          query = query.or(filterString)
        }

        log?.debug(`Discovering records for ${dependentTable}`)
        const { data, error } = await query

        if (error) {
          log?.error('Error discovering records', { error })
          throw new Error(`Error discovering records: ${error.message}`)
        }

        data.length &&
          log?.debug(`Discovered ${data.length} records for ${dependentTable}`)

        for (const record of data) {
          this.record({
            schema: dependentTableSchema,
            table: dependentTableName,
            data: record as unknown as Select<
              Database,
              Schema,
              TableIn<Database, Schema>
            >
          })
          tablesToVisit.push({
            schema: dependentTableSchema,
            name: dependentTableName
          })
        }
      }
    }
  }

  /**
   * Creates a test-ready Supabase client for the given schema.
   * @param schema The schema to use for the client
   * @returns A supabase client for the given schema
   */
  public supabase<S extends Schema>(schema: S): SupabaseClient<Database, S> {
    const credentials = {
      supabaseUrl:
        this.options?.supabase?.supabaseUrl ??
        process.env.SUPABASE_URL ??
        DEFAULT_SUPABASE_URL,
      serviceRoleKey:
        this.options?.supabase?.serviceRoleKey ??
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        DEFAULT_SUPABASE_SERVICE_ROLE_KEY
    }
    return createSupabaseTestClient<Database, S>(
      credentials as SupabaseClientCredentials,
      schema
    )
  }

  private createDependencyGraph(): DependencyGraph<Database, Schema> {
    const dependents = {} as DependencyGraph<Database, Schema>
    const schemas = [...this.schemas]
    if ('auth' in this.tables) {
      schemas.unshift('auth' as Schema)
    }
    for (const schema of schemas) {
      for (const table of Object.keys(this.tables[schema]) as TableIn<
        Database,
        Schema
      >[]) {
        const key = `${schema}.${table}` as `${Schema}.${TableIn<Database, Schema>}`

        if (!dependents[key]) {
          dependents[key] = {}
        }
        for (const [column, dependency] of Object.entries(
          this.tables[schema][table].foreignKeys
        )) {
          const dependencyKey =
            `${dependency.table.schema}.${dependency.table.name}` as `${Schema}.${TableIn<
              Database,
              Schema
            >}`

          // We don't care about self-referencing foreign keys.
          if (dependencyKey === key) {
            continue
          }

          if (!dependents[dependencyKey]) {
            dependents[dependencyKey] = {}
          }
          if (!dependents[dependencyKey][key]) {
            dependents[dependencyKey][key] = []
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          dependents[dependencyKey][key]!.push({
            column,
            references: dependency.foreignColumnName
          })
        }
      }
    }
    return dependents
  }

  /**
   * Use topology sort to create an ordering of tables in which they can be
   * deleted without violating foreign key constraints.
   * @returns An array of table names in the order they can be deleted.
   */
  private createRecordTypeOrdering(): (
    | `${Schema}.${TableIn<Database, Schema>}`
    | 'auth.users'
  )[] {
    const visited = new Set<`${Schema}.${TableIn<Database, Schema>}`>()
    const recordTypeOrdering: `${Schema}.${TableIn<Database, Schema>}`[] = []

    const visit = (table: `${Schema}.${TableIn<Database, Schema>}`) => {
      if (visited.has(table)) {
        return
      }
      visited.add(table)
      const dependencies = this.dependencyGraph[table]
      for (const dependency of Object.keys(dependencies) as `${Schema}.${TableIn<
        Database,
        Schema
      >}`[]) {
        visit(dependency)
      }
      recordTypeOrdering.push(table)
    }

    for (const table of this.getRootTables()) {
      visit(`${table.schema}.${table.name}` as `${Schema}.${TableIn<Database, Schema>}`)
    }

    return recordTypeOrdering
  }

  /**
   * Remove all records added to the database during the Supawright instance's
   * lifecycle.
   *
   * Handles dependencies between fixtures i.e. removes fixtures in an order
   * which respects foreign key constraints.
   */
  public async teardown() {
    log?.debug('Tearing down Supawright')
    await this.discoverRecords()
    const recordTypeOrdering = this.createRecordTypeOrdering()
    log?.debug('Deleting records in order', { recordTypeOrdering })

    for (const qualifiedTable of recordTypeOrdering) {
      if (qualifiedTable === 'auth.users') {
        continue
      }
      const [schema, table] = qualifiedTable.split('.') as [
        Schema,
        TableIn<Database, Schema>
      ]
      const fixtures = this.fixtures(schema, table)
      if (!fixtures.length) {
        continue
      }
      log?.debug(`Deleting ${fixtures.length} records from ${qualifiedTable}`)

      const tableDefinition = this.tables[schema][table]
      if (!tableDefinition) {
        throw new Error(`Could not find table definition for ${qualifiedTable}`)
      }

      const supabase = this.supabase(schema)
      let deletionQuery = supabase.from(table).delete()
      if (tableDefinition.primaryKeys.length > 0) {
        const filterStrings = []
        for (const fixture of fixtures) {
          const filterString = tableDefinition.primaryKeys
            .map((key) => `${key}.eq.${fixture.data[key]}`)
            .join(',')
          if (tableDefinition.primaryKeys.length > 1) {
            filterStrings.push(`and(${filterString})`)
          } else {
            filterStrings.push(filterString)
          }
        }
        deletionQuery = deletionQuery.or(filterStrings.join(','))
      } else {
        throw new Error(
          `Cannot delete records from table ${qualifiedTable} as it has no primary key`
        )
      }

      const { data, error } = await deletionQuery.select()
      if (error) {
        log?.error('Error deleting records', { error })
        throw new Error(`Error deleting records: ${error.message}`)
      }
      log?.debug(`Deleted ${data?.length} records from ${qualifiedTable}`)
    }

    const authRecordsToRemove = this.fixtures('auth' as Schema, 'users').map(
      (fixture) => fixture.data.id as string
    )

    log?.debug('Deleting storage objects')
    const supabase = this.supabase(this.schemas[0])
    await Promise.allSettled(
      (await supabase.storage.listBuckets()).data?.map(async (bucket) => {
        const { data: allObjects, error } = await supabase.storage
          .from(bucket.name)
          .list()

        if (error) {
          log?.error('Error listing objects in bucket', { error, bucket })
          throw new Error(`Error listing objects in bucket: ${error.message}`)
        }

        await supabase.storage
          .from(bucket.name)
          .remove(
            allObjects
              ?.filter((object) => authRecordsToRemove.includes(object.owner))
              .map((object) => object.name) ?? []
          )
      }) ?? []
    )

    log?.debug(`Removing ${authRecordsToRemove.length} auth records`)
    for (const authRecord of authRecordsToRemove) {
      const { error } = await supabase.auth.admin.deleteUser(authRecord)
      if (error) {
        log?.error('Error removing auth record', { error, authRecord })
        throw new Error(`Error removing auth record ${authRecord}: ${error.message}`)
      }
    }
    // Clear local cache.
    this._fixtures.clear()
  }

  /**
   * Creates a new user using `supabase.auth.admin.createUser` and records
   * it in Supawright.
   * @param attributes The user attributes usually passed to
   * `supabase.auth.admin.createUser`
   * @throws If the user could not be created
   */
  public async createUser(attributes?: AdminUserAttributes): Promise<User> {
    const { data, error } = await this.supabase(this.schemas[0]).auth.admin.createUser({
      email: faker.internet.email(),
      password: faker.internet.password(),
      ...attributes
    })
    if (error) {
      log.error('Error creating user', { error, attributes })
      throw new Error(`Error creating user: ${error.message}`)
    }
    this.record({
      schema: 'auth',
      table: 'users',
      data: data.user as unknown as Select<Database, 'auth', 'users'>
    })
    return data.user
  }

  /**
   * Creates a new record in the database.
   * @param schema The schema name of the record to create. Defaults to 'public'
   * @param table The table name of the record to create
   * @param data The data to create the record with
   * @returns The created record
   * @throws If the record could not be created
   * @throws If the record could not be found after creation
   */
  public async create<
    S extends 'public' extends Schema ? 'public' : never,
    Table extends TableIn<Database, 'public'>
  >(
    table: S extends 'public' ? Table : never,
    data?: S extends 'public' ? Partial<Insert<Database, S, Table>> : never
  ): Promise<Select<Database, S, Table>>
  public async create<S extends Schema, Table extends TableIn<Database, S>>(
    schema: S,
    table: Table,
    data?: Partial<Insert<Database, S, Table>>
  ): Promise<Select<Database, S, Table>>
  public async create<S extends Schema, Table extends TableIn<Database, S>>(
    schemaOrTable: S | Table,
    tableOrData?: Table | Partial<Insert<Database, S, Table>>,
    data?: Partial<Insert<Database, S, Table>>
  ): Promise<Select<Database, S, Table>> {
    let schema: S
    let table: Table

    if (typeof tableOrData === 'string') {
      schema = schemaOrTable as S
      table = tableOrData
    } else {
      schema = 'public' as S
      table = schemaOrTable as Table
      data = tableOrData
    }

    log?.debug(`create('${table}', '${JSON.stringify(data)}')`)

    const dataGenerators: Generators<Database, Schema> = {
      ...fakeDataGenerators,
      ...this.options?.generators
    }

    if (
      schema === 'auth' &&
      table === 'users' &&
      !this.options?.overrides?.auth?.users
    ) {
      return (await this.createUser(data as AdminUserAttributes)) as unknown as Select<
        Database,
        S,
        Table
      >
    }

    const supabase = this.supabase(schema)
    // See if there's a custom creator for this table,
    // and call it if there is.
    if (this.options?.overrides?.[schema]?.[table]) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const newFixtures = await this.options.overrides[schema]![table]!({
        supawright: this,
        data: data ?? {},
        supabase,
        generators: dataGenerators
      })
      for (const newFixture of newFixtures) {
        this.record(newFixture as Fixture<Database, Schema, TableIn<Database, Schema>>)
      }
      const fixtureForTable = newFixtures.find((fixture) => fixture.table === table)
      if (!fixtureForTable) {
        throw new Error(`No fixture for table ${table} returned by custom creator`)
      }
      return fixtureForTable.data as Select<Database, S, Table>
    }

    if (!data) {
      data = {}
    }
    const row = this.tables[schema][table]

    // Generate dummy data for all required columns
    for (const [column, type] of Object.entries(row.requiredColumns)) {
      if (data[column]) {
        continue
      }
      if (row.foreignKeys[column] && !row.foreignKeys[column].nullable) {
        const newTable = row.foreignKeys[column].table.name
        const newSchema = row.foreignKeys[column].table.schema as Schema
        let newRecord: Select<Database, S, Table> | undefined

        // If there's already a record for this table, use it.
        log.debug(`Looking for existing record for ${newSchema}.${newTable}`)
        log.debug(this._fixtures)
        const fixtures = this._fixtures.get(newSchema, newTable)
        if (fixtures.length > 0) {
          log.debug(`Found ${fixtures.length} existing records`)
          newRecord = fixtures[0].data
        } else {
          log.debug('No existing records found, creating new record')
          newRecord = await this.create(newSchema, newTable, {})
        }

        data[column as keyof typeof data] =
          newRecord[row.foreignKeys[column].foreignColumnName as keyof typeof newRecord]
      } else if (!row.foreignKeys[column]) {
        data[column as keyof typeof data] = this.getGeneratedValueForType(
          table,
          column,
          type
        ) as (typeof data)[keyof typeof data]
      }
    }

    const { data: insertData, error } = await supabase
      .from(table)
      .insert(data as any)
      .select()
      .single()

    if (error) {
      log?.error('Error inserting data', { error, table })
      throw new Error(
        `Error inserting data into ${table}: ${error.message}\nData: ${JSON.stringify(data)}`
      )
    }

    data = insertData as typeof data
    log.debug(`Recording ${schema}.${table}`)
    this.record({ schema, table, data })

    return data
  }

  /**
   * Generate data for the column. First try the user-defined generators,
   * then fall back to built-in generators. If the column is a USER-DEFINED
   * enum, fall back to using a random enum value instead.
   *
   * `type` will be an object if it's a user-defined type, and a string
   * otherwise.
   */
  private getGeneratedValueForType(
    table: string,
    column: string,
    type: string | { schema: string; name: string }
  ): unknown {
    let val: unknown = null

    if (typeof type === 'string') {
      // Regular type
      // Special case for email columns
      if (
        (type.includes('text') || type.includes('varchar')) &&
        column.includes('email')
      ) {
        return faker.internet.email()
      }

      // Try user-defined generator if it exists, otherwise fall back to built-in
      const userDefinedGenerator = this.options?.generators?.[type]
      val = userDefinedGenerator?.(table, column)
      if (val !== null && val !== undefined) {
        return val
      }

      const builtInGenerator =
        fakeDataGenerators[type as keyof typeof fakeDataGenerators]
      val = builtInGenerator?.()
      if (val !== null && val !== undefined) {
        return val
      }
    } else {
      // User-defined type
      const enumType: Enum | undefined = this.enums[type.schema][type.name]
      if (this.options?.generators?.['USER-DEFINED']) {
        val = this.options.generators['USER-DEFINED'](table, column)
        if (val !== null && val !== undefined) {
          return val
        }
      }

      if (enumType) {
        // Search for enum
        val = enumType.values[Math.floor(Math.random() * enumType.values.length)]
        if (val !== null && val !== undefined) {
          return val
        }
      }
    }
    if (!val) {
      throw new Error(`No generator for type ${JSON.stringify(type)}`)
    }
    return val
  }
}
