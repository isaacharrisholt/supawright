import { faker } from '@faker-js/faker'
import { SupabaseClient, type AdminUserAttributes } from '@supabase/supabase-js'
import { Fixtures } from './fixtures'
import { Tables, fakeDataGenerators, getSchemaTree } from './tree'
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
  harness: TestHarness<Database, Schema>
  data: Partial<Insert<Database, Schema, Table>>
  supabase: SupabaseClient<Database, Schema>
  generators: Generators<Database, Schema>
}) => Promise<Fixture<Database, Schema | 'auth', TableIn<Database, Schema> | 'users'>[]>

export type HarnessOptions<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> = {
  generators?: Generators<Database, Schema>
  creators?: {
    [S in Schema]?: {
      [Table in TableIn<Database, S>]?: Creator<Database, Schema, Table>
    }
  }
  supabaseClientCredentials?: SupabaseClientCredentials
}

/**
 * Test harness class.
 *
 * This class provides public methods for creating and accessing records required
 * for testing. It also provides a teardown method which removes all records
 * created during the lifecycle of the test harness.
 *
 * Note that the teardown method respects foreign key constraints, so records
 * are removed in an order which respects FK constraints.
 */
export class TestHarness<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> {
  private _fixtures: Fixtures<Database, Schema> = new Fixtures()

  public static async new<
    Database extends GenericDatabase,
    Schema extends SchemaOf<Database>
  >(schemas: [Schema, ...Schema[]], options?: HarnessOptions<Database, Schema>) {
    if (!schemas.length) {
      throw new Error('No schemas provided')
    }
    const tables = await getSchemaTree(schemas)
    return new TestHarness(schemas, tables, options)
  }

  private constructor(
    private schemas: Schema[],
    private tables: Tables,
    private readonly options?: HarnessOptions<Database, Schema>
  ) {}

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
   * Refreshes the current object from the database and updates the harness' internal store
   * @param table The table name of the object to refresh
   * @param current The current object to refresh
   * @param options What column to sort by (if the table doesn't have an ID column)
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
      throw new Error('Failed to refresh fixture: ' + error.message)
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
   */
  async discoverRecords() {
    const tablesToVisit = this.getRootTables()
    // For each of the root tables, discover records for all dependent tables.
    const dependencyGraph = this.getDependencyGraph()
    while (tablesToVisit.length) {
      const rootTable = tablesToVisit.shift()

      if (!rootTable) {
        continue
      }

      const { schema: rootTableSchema, name: rootTableName } = rootTable
      log?.debug(
        `Discovering records for dependents of ${rootTableSchema}.${rootTableName}`
      )

      const dependentTables = dependencyGraph[`${rootTableSchema}.${rootTableName}`]
      const rootTableFixtures = this.fixtures(rootTableSchema, rootTableName)
      for (const [dependentTable, dependencies] of Object.entries(dependentTables)) {
        log?.debug(`Discovering records for ${dependentTable}`)
        const [dependentTableSchema, dependentTableName] = dependentTable.split(
          '.'
        ) as [Schema, TableIn<Database, Schema>]
        const supabase = this.supabase(dependentTableSchema)
        let query = supabase.from(dependentTableName).select()

        for (const dependency of dependencies as any[]) {
          query = query.or(
            `${dependency.column}.in.(${rootTableFixtures
              .map(
                (fixture) =>
                  fixture.data[dependency.references as keyof typeof fixture.data]
              )
              .join(',')})`
          )
        }

        const { data, error } = await query

        if (error) {
          log?.error('Error discovering records', { error })
          throw new Error('Error discovering records: ' + error.message)
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
  public supabase(schema?: Schema) {
    schema = schema ?? (this.schemas[0] as Schema)
    const credentials = {
      supabaseUrl:
        this.options?.supabaseClientCredentials?.supabaseUrl ??
        process.env.SUPABASE_URL,
      serviceRoleKey:
        this.options?.supabaseClientCredentials?.serviceRoleKey ??
        process.env.SUPABASE_SERVICE_ROLE_KEY
    }
    if (!credentials.supabaseUrl) {
      throw new Error('SUPABASE_URL is not set and no credentials provided')
    }
    if (!credentials.serviceRoleKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not set and no credentials provided'
      )
    }
    return createSupabaseTestClient<Database, Schema>(
      credentials as SupabaseClientCredentials,
      schema
    )
  }

  private getDependencyGraph(): DependencyGraph<Database, Schema> {
    const dependents = {} as DependencyGraph<Database, Schema>
    for (const schema of ['auth', ...this.schemas]) {
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
    const dependencyGraph = this.getDependencyGraph()

    const visited = new Set<`${Schema}.${TableIn<Database, Schema>}`>()
    const recordTypeOrdering: `${Schema}.${TableIn<Database, Schema>}`[] = []

    const visit = (table: `${Schema}.${TableIn<Database, Schema>}`) => {
      if (visited.has(table)) {
        return
      }
      visited.add(table)
      const dependencies = dependencyGraph[table]
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
   * Remove all records added to the database during the harness lifecycle.
   *
   * Handles dependencies between fixtures i.e. removes fixtures in an order
   * which respects foreign key constraints.
   */
  public async teardown() {
    log?.debug('Tearing down test harness')
    await this.discoverRecords()
    const recordTypeOrdering = this.createRecordTypeOrdering()

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
        throw new Error('Error deleting records: ' + error.message)
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
          throw new Error('Error listing objects in bucket: ' + error.message)
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
        throw new Error(`Error removing auth record ${authRecord}: ` + error.message)
      }
    }
    // Clear local cache.
    this._fixtures.clear()
  }

  /**
   * Creates a new user using `supabase.auth.admin.createUser` and records
   * it in the harness.
   * @param attributes The user attributes usually passed to
   * `supabase.auth.admin.createUser`
   * @throws If the user could not be created
   */
  public async createUser(attributes: AdminUserAttributes) {
    const { data, error } = await this.supabase().auth.admin.createUser(attributes)
    if (error) {
      log.error('Error creating user', { error, attributes })
      throw new Error('Error creating user: ' + error.message)
    }
    this.record({
      schema: 'auth',
      table: 'users',
      data: data as unknown as Select<Database, 'auth', 'users'>
    })
  }

  /**
   * Creates a new record in the database.
   * @param table The table name of the record to create
   * @param data The data to create the record with
   * @returns The created record
   * @throws If the record could not be created
   * @throws If the record could not be found after creation
   */
  public async create<S extends Schema, Table extends TableIn<Database, S>>(
    schema: S,
    table: Table,
    data?: Partial<Insert<Database, S, Table>>
  ): Promise<Select<Database, S, Table>> {
    log?.debug(`create('${table}', '${JSON.stringify(data)}')`)
    const supabase = this.supabase(schema)

    const dataGenerators: Generators<Database, Schema> = {
      ...fakeDataGenerators,
      ...this.options?.generators
    }

    if (this.options?.creators?.[schema]?.[table]) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const newFixtures = await this.options.creators[schema]![table]!({
        harness: this,
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

    // If there's already a record for this table, return it
    const fixtures = this._fixtures.get(schema, table)
    if (fixtures.length > 0) {
      return fixtures[0]!.data
    }

    if (!data) {
      data = {}
    }
    const row = this.tables[schema][table]

    for (const [column, type] of Object.entries(row.requiredColumns)) {
      if (data[column]) {
        continue
      }
      if (row.foreignKeys[column] && !row.foreignKeys[column].nullable) {
        const newTable = row.foreignKeys[column].table.name
        const newSchema = row.foreignKeys[column].table.schema

        const newRecord = await this.create(newSchema as Schema, newTable, {})
        data[column as keyof typeof data] =
          newRecord[row.foreignKeys[column].foreignColumnName as keyof typeof newRecord]
      } else if (!row.foreignKeys[column]) {
        const generator = dataGenerators[type as keyof typeof dataGenerators]
        if (!generator) {
          throw new Error(`No generator for type ${type}`)
        }
        data[column as keyof typeof data] = generator(table, column) as any
        if (column.includes('email')) {
          data[column as keyof typeof data] = faker.internet.email() as any
        }
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
        `Error inserting data into ${table}: ` +
          error.message +
          '\nData: ' +
          JSON.stringify(data)
      )
    }

    data = insertData as typeof data
    this.record({ schema, table, data })

    return data
  }
}
