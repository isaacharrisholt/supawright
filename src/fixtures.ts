import { Fixture, GenericDatabase, SchemaOf, TableIn } from './types'

type ReadonlyFixtures<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> = {
  get(): Fixture<Database, Schema, TableIn<Database, Schema>>[]
  get<S extends Schema, Table extends TableIn<Database, S>>(
    schema: S,
    table: Table
  ): Fixture<Database, Schema, Table>[]
}

export class Fixtures<
  Database extends GenericDatabase,
  Schema extends SchemaOf<Database>
> {
  private _fixtures: Fixture<Database, Schema, TableIn<Database, Schema>>[] = []

  public get(): Fixture<Database, Schema, TableIn<Database, Schema>>[]
  public get<S extends Schema, Table extends TableIn<Database, S>>(
    schema: S,
    table: Table
  ): Fixture<Database, Schema, Table>[]
  public get<S extends Schema, Table extends TableIn<Database, S>>(
    schema?: S,
    table?: Table
  ) {
    if (!table || !schema) {
      return this._fixtures
    }
    return this._fixtures.filter(
      (fixture) => fixture.table === table && fixture.schema === schema
    )
  }

  public add(fixture: Fixture<Database, Schema, TableIn<Database, Schema>>) {
    this._fixtures.push(fixture)
  }

  public getReadOnly(): ReadonlyFixtures<Database, Schema> {
    return {
      get: this.get.bind(this)
    }
  }

  public update(
    schema: Schema,
    table: TableIn<Database, Schema>,
    fixture: Fixture<Database, Schema, TableIn<Database, Schema>>,
    by: string & keyof Fixture<Database, Schema, TableIn<Database, Schema>>['data']
  ) {
    const existingIdx = this._fixtures.findIndex(
      (existingFixture) =>
        existingFixture.table === table &&
        existingFixture.schema === schema &&
        existingFixture.data[by] === fixture.data[by]
    )
    if (existingIdx === -1) {
      throw new Error('No existing fixture found')
    }
    this._fixtures[existingIdx] = fixture
  }

  public clear() {
    this._fixtures = []
  }
}
