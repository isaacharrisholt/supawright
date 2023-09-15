create table create_fields (
    id bigint not null primary key,
    optional_column text,
    default_column text not null default 'this is a default value',
    required_column text[] not null
);