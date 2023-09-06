create table create_recursive_parent_1 (
    id bigint not null primary key,
    name text not null,
    optional_column integer
);

create table create_recursive_parent_2 (
    id bigint not null generated always as identity primary key
);

create table create_recursive_child_1 (
    id bigint not null primary key,
    required_foreign_key bigint not null references create_recursive_parent_1(id),
    optional_foreign_key bigint references create_recursive_parent_2(id)
);

create table create_recursive_child_2 (
    id bigint not null primary key,
    required_foreign_key_1 bigint not null references create_recursive_parent_1(id),
    required_foreign_key_2 bigint not null references create_recursive_parent_2(id)
);

create table create_recursive_grandchild_1 (
    id bigint not null primary key,
    required_foreign_key bigint not null references create_recursive_child_1(id)
);

create table create_recursive_grandchild_2 (
    id bigint not null primary key,
    required_foreign_key_1 bigint not null references create_recursive_parent_1(id),
    required_foreign_key_2 bigint not null references create_recursive_child_1(id)
);