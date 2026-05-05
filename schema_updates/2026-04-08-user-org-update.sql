-- Rentzu schema update
-- 2026-04-08
-- Goal:
-- 1. users: move from full_name to first_name + last_name
-- 2. organizations: add entity_type
-- 3. keep organization_users table

alter table users
    add column if not exists first_name text,
    add column if not exists last_name text;

update users
set
    first_name = coalesce(first_name, split_part(coalesce(full_name, ''), ' ', 1)),
    last_name = coalesce(last_name, nullif(trim(substr(coalesce(full_name, ''), length(split_part(coalesce(full_name, ''), ' ', 1)) + 1)), ''))
where first_name is null or last_name is null;

alter table users
    alter column first_name set default '',
    alter column last_name set default '';

update users
set first_name = coalesce(first_name, ''),
    last_name = coalesce(last_name, '');

alter table users
    alter column first_name set not null,
    alter column last_name set not null;

alter table organizations
    add column if not exists entity_type text;

update organizations
set entity_type = coalesce(entity_type, 'individual')
where entity_type is null;

alter table organizations
    alter column entity_type set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'organizations_entity_type_check'
    ) then
        alter table organizations
            add constraint organizations_entity_type_check
            check (entity_type in ('individual', 'llc'));
    end if;
end $$;
