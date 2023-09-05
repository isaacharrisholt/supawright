import { withSupawright } from './test'

type MyDatabase = {
  public: {
    Tables: {
      public_table: {
        Row: { a: number }
        Insert: { a: number }
        Update: { a: number }
      }
    }
    Views: {}
    Functions: {}
  }
  private: {
    Tables: {
      private_table: {
        Row: { b: number }
        Insert: { b: number }
        Update: { b: number }
      }
    }
    Views: {}
    Functions: {}
  }
}

const test = withSupawright<MyDatabase, 'private' | 'public'>(['private', 'public'])

type A = 'a' | never

function thing<T extends string>(foo: string): void
function thing<T extends number>(foo: T, bar: number): void
function thing<T>(foo: T, bar?: number): void {
  console.log(foo, bar)
}

test('thing', async ({ supawright }) => {
  await supawright.create('public_table')
  await supawright.create('private', 'private_table', { b: 2 })
  thing<10>(10, 10)
})
