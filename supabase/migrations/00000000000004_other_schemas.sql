create schema other;

create table other.other_schemas_parent (
    id bigint not null generated always as identity primary key
);

create table public.other_schemas_foreign_child (
    id bigint not null generated always as identity primary key,
    parent_id bigint not null references other.other_schemas_parent (id)
);

create table other.other_schemas_local_child (
    id bigint not null generated always as identity primary key,
    parent_id bigint not null references other.other_schemas_parent (id)
);