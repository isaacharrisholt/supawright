create table teardown_parent (
    id uuid not null primary key
);

create table teardown_child (
    id uuid not null primary key,
    parent_id uuid not null references teardown_parent (id)
);

create table teardown_auth_dependent (
    id bigint not null generated always as identity primary key,
    user_id uuid not null references auth.users (id)
);