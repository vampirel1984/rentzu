-- Rentzu schema update
-- 2026-04-08
-- Add email verification code table for auth flow

create extension if not exists pgcrypto;

create table if not exists email_verification_codes (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    code text not null,
    status text not null default 'pending' check (status in ('pending', 'verified', 'expired')),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    verified_at timestamptz
);

create index if not exists idx_email_verification_codes_email on email_verification_codes(email);
create index if not exists idx_email_verification_codes_status on email_verification_codes(status);

-- Current local dev reminder:
-- PostgreSQL db: rentzu
-- PostgreSQL password: password
