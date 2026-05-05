alter table if exists users
    add column if not exists password_hash text;

alter table if exists users
    add column if not exists email_verified_at timestamptz;

create table if not exists organization_users (
    organization_id uuid not null,
    user_id uuid not null,
    role text not null,
    created_at timestamptz not null default now(),
    primary key (organization_id, user_id)
);

create index if not exists idx_organization_users_user_id on organization_users(user_id);
