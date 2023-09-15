create schema other;
grant usage on schema other to anon, authenticated, service_role;
grant all on all tables in schema other to anon, authenticated, service_role;
grant all on all routines in schema other to anon, authenticated, service_role;
grant all on all sequences in schema other to anon, authenticated, service_role;
alter default privileges for role postgres in schema other grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema other grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema other grant all on sequences to anon, authenticated, service_role;

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