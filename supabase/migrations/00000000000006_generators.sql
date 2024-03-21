create table generators (
    id bigint not null generated always as identity primary key,
    name text not null,
    age bigint not null
);
