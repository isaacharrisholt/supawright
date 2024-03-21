export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  other: {
    Tables: {
      other_schemas_local_child: {
        Row: {
          id: number
          parent_id: number
        }
        Insert: {
          id?: never
          parent_id: number
        }
        Update: {
          id?: never
          parent_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'other_schemas_local_child_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'other_schemas_parent'
            referencedColumns: ['id']
          }
        ]
      }
      other_schemas_parent: {
        Row: {
          id: number
        }
        Insert: {
          id?: never
        }
        Update: {
          id?: never
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      create_fields: {
        Row: {
          default_column: string
          id: number
          optional_column: string | null
          required_column: string[]
        }
        Insert: {
          default_column?: string
          id: number
          optional_column?: string | null
          required_column: string[]
        }
        Update: {
          default_column?: string
          id?: number
          optional_column?: string | null
          required_column?: string[]
        }
        Relationships: []
      }
      create_recursive_child_1: {
        Row: {
          id: number
          optional_foreign_key: number | null
          required_foreign_key: number
        }
        Insert: {
          id: number
          optional_foreign_key?: number | null
          required_foreign_key: number
        }
        Update: {
          id?: number
          optional_foreign_key?: number | null
          required_foreign_key?: number
        }
        Relationships: [
          {
            foreignKeyName: 'create_recursive_child_1_optional_foreign_key_fkey'
            columns: ['optional_foreign_key']
            referencedRelation: 'create_recursive_parent_2'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'create_recursive_child_1_required_foreign_key_fkey'
            columns: ['required_foreign_key']
            referencedRelation: 'create_recursive_parent_1'
            referencedColumns: ['id']
          }
        ]
      }
      create_recursive_child_2: {
        Row: {
          id: number
          required_foreign_key_1: number
          required_foreign_key_2: number
        }
        Insert: {
          id: number
          required_foreign_key_1: number
          required_foreign_key_2: number
        }
        Update: {
          id?: number
          required_foreign_key_1?: number
          required_foreign_key_2?: number
        }
        Relationships: [
          {
            foreignKeyName: 'create_recursive_child_2_required_foreign_key_1_fkey'
            columns: ['required_foreign_key_1']
            referencedRelation: 'create_recursive_parent_1'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'create_recursive_child_2_required_foreign_key_2_fkey'
            columns: ['required_foreign_key_2']
            referencedRelation: 'create_recursive_parent_2'
            referencedColumns: ['id']
          }
        ]
      }
      create_recursive_grandchild_1: {
        Row: {
          id: number
          required_foreign_key: number
        }
        Insert: {
          id: number
          required_foreign_key: number
        }
        Update: {
          id?: number
          required_foreign_key?: number
        }
        Relationships: [
          {
            foreignKeyName: 'create_recursive_grandchild_1_required_foreign_key_fkey'
            columns: ['required_foreign_key']
            referencedRelation: 'create_recursive_child_1'
            referencedColumns: ['id']
          }
        ]
      }
      create_recursive_grandchild_2: {
        Row: {
          id: number
          required_foreign_key_1: number
          required_foreign_key_2: number
        }
        Insert: {
          id: number
          required_foreign_key_1: number
          required_foreign_key_2: number
        }
        Update: {
          id?: number
          required_foreign_key_1?: number
          required_foreign_key_2?: number
        }
        Relationships: [
          {
            foreignKeyName: 'create_recursive_grandchild_2_required_foreign_key_1_fkey'
            columns: ['required_foreign_key_1']
            referencedRelation: 'create_recursive_parent_1'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'create_recursive_grandchild_2_required_foreign_key_2_fkey'
            columns: ['required_foreign_key_2']
            referencedRelation: 'create_recursive_child_1'
            referencedColumns: ['id']
          }
        ]
      }
      create_recursive_parent_1: {
        Row: {
          id: number
          name: string
          optional_column: number | null
        }
        Insert: {
          id: number
          name: string
          optional_column?: number | null
        }
        Update: {
          id?: number
          name?: string
          optional_column?: number | null
        }
        Relationships: []
      }
      create_recursive_parent_2: {
        Row: {
          id: number
        }
        Insert: {
          id?: never
        }
        Update: {
          id?: never
        }
        Relationships: []
      }
      create_recursive_requires_auth_user: {
        Row: {
          id: number
          user_id: string
        }
        Insert: {
          id?: number
          user_id: string
        }
        Update: {
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'create_recursive_requires_auth_user_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      enum_table: {
        Row: {
          enum_column: Database['public']['Enums']['some_enum'] | null
          id: number
          required_enum_column: Database['public']['Enums']['another_enum']
        }
        Insert: {
          enum_column?: Database['public']['Enums']['some_enum'] | null
          id?: never
          required_enum_column: Database['public']['Enums']['another_enum']
        }
        Update: {
          enum_column?: Database['public']['Enums']['some_enum'] | null
          id?: never
          required_enum_column?: Database['public']['Enums']['another_enum']
        }
        Relationships: []
      }
      generators: {
        Row: {
          age: number
          id: number
          name: string
        }
        Insert: {
          age: number
          id?: never
          name: string
        }
        Update: {
          age?: number
          id?: never
          name?: string
        }
        Relationships: []
      }
      other_schemas_foreign_child: {
        Row: {
          id: number
          parent_id: number
        }
        Insert: {
          id?: never
          parent_id: number
        }
        Update: {
          id?: never
          parent_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'other_schemas_foreign_child_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'other_schemas_parent'
            referencedColumns: ['id']
          }
        ]
      }
      teardown_auth_dependent: {
        Row: {
          id: number
          user_id: string
        }
        Insert: {
          id?: never
          user_id: string
        }
        Update: {
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teardown_auth_dependent_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      teardown_child: {
        Row: {
          id: string
          parent_id: string
        }
        Insert: {
          id: string
          parent_id: string
        }
        Update: {
          id?: string
          parent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teardown_child_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'teardown_parent'
            referencedColumns: ['id']
          }
        ]
      }
      teardown_parent: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      another_enum: 'x' | 'y' | 'z'
      some_enum: 'a' | 'b' | 'c'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          public: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'buckets_owner_fkey'
            columns: ['owner']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          path_tokens: string[] | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'objects_bucketId_fkey'
            columns: ['bucket_id']
            referencedRelation: 'buckets'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string
          name: string
          owner: string
          metadata: Json
        }
        Returns: undefined
      }
      extension: {
        Args: {
          name: string
        }
        Returns: string
      }
      filename: {
        Args: {
          name: string
        }
        Returns: string
      }
      foldername: {
        Args: {
          name: string
        }
        Returns: unknown
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
