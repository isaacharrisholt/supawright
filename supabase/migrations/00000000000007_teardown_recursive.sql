create table teardown_grandchild (
    id uuid not null primary key,
    child_id uuid not null references teardown_child (id)
);
