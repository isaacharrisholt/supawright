create type some_enum as enum ('a', 'b', 'c');
create type another_enum as enum ('x', 'y', 'z');

create table enum_table (
  id bigint generated always as identity primary key,
  enum_column some_enum,
  required_enum_column another_enum not null
);
