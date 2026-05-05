-- Rentzu landlord app
-- Minimal financial-record pipeline schema
-- Final reviewed version

-- Recommended extensions
create extension if not exists pgcrypto;

-- =====================================================
-- 1. Organizations / Users
-- =====================================================

create table if not exists organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    entity_type text not null check (entity_type in ('individual', 'llc')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    first_name text not null,
    last_name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists organization_users (
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'manager', 'viewer')),
    created_at timestamptz not null default now(),
    primary key (organization_id, user_id)
);

-- =====================================================
-- 2. Property / Unit / Renter / Lease
-- =====================================================

create table if not exists properties (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,

    name text not null,
    property_type text not null check (
        property_type in (
            'single_family',
            'duplex',
            'triplex',
            'fourplex',
            'multi_family',
            'condo',
            'townhome',
            'room_rental',
            'other'
        )
    ),

    address_line_1 text not null,
    address_line_2 text,
    city text,
    state text,
    postal_code text,
    country text default 'US',

    total_units integer not null default 1 check (total_units > 0),
    is_active boolean not null default true,
    notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_properties_org on properties(organization_id);

create table if not exists units (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id) on delete cascade,

    unit_code text not null,
    unit_type text check (
        unit_type in ('apartment', 'room', 'studio', 'adu', 'basement', 'other')
    ),

    bedroom_count numeric(4,1),
    bathroom_count numeric(4,1),
    square_feet integer,
    market_rent numeric(12,2),

    is_active boolean not null default true,
    notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (property_id, unit_code)
);

create index if not exists idx_units_property on units(property_id);

create table if not exists renters (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,

    first_name text not null,
    last_name text not null,
    full_name text generated always as (trim(first_name || ' ' || last_name)) stored,

    email text,
    phone text,
    date_of_birth date,

    emergency_contact_name text,
    emergency_contact_phone text,
    notes text,
    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_renters_org on renters(organization_id);

create table if not exists leases (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    property_id uuid not null references properties(id) on delete cascade,
    unit_id uuid not null references units(id) on delete cascade,

    lease_number text,
    status text not null check (status in ('draft', 'active', 'ended', 'terminated', 'renewed')),

    start_date date not null,
    end_date date,
    move_in_date date,
    move_out_date date,

    rent_amount numeric(12,2) not null,
    security_deposit numeric(12,2) default 0,
    late_fee_amount numeric(12,2) default 0,
    due_day integer not null default 1 check (due_day between 1 and 31),
    payment_frequency text not null default 'monthly' check (
        payment_frequency in ('monthly', 'weekly', 'biweekly', 'quarterly', 'yearly')
    ),

    currency text not null default 'USD',
    notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_leases_org on leases(organization_id);
create index if not exists idx_leases_property on leases(property_id);
create index if not exists idx_leases_unit on leases(unit_id);
create index if not exists idx_leases_status on leases(status);

create table if not exists lease_renters (
    lease_id uuid not null references leases(id) on delete cascade,
    renter_id uuid not null references renters(id) on delete cascade,
    role text not null default 'tenant' check (
        role in ('primary', 'co_tenant', 'occupant', 'guarantor', 'tenant')
    ),
    created_at timestamptz not null default now(),
    primary key (lease_id, renter_id)
);

-- =====================================================
-- 3. Raw input and AI extraction staging
-- =====================================================

create table if not exists raw_entries (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    source_type text not null check (source_type in ('voice', 'manual', 'import', 'api')),
    original_input_text text,
    final_confirmed_text text not null,
    created_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_raw_entries_org on raw_entries(organization_id);
create index if not exists idx_raw_entries_created_at on raw_entries(created_at desc);

create table if not exists extracted_financial_records (
    id uuid primary key default gen_random_uuid(),
    raw_entry_id uuid not null references raw_entries(id) on delete cascade,

    type text check (type in ('expense', 'income')),
    amount numeric(12,2),
    counterparty text,
    description text,
    record_date date,

    extraction_model text,
    extraction_confidence numeric(5,4),
    extraction_json jsonb,

    status text not null default 'extracted' check (
        status in ('extracted', 'mapped', 'confirmed', 'rejected')
    ),

    created_at timestamptz not null default now()
);

create index if not exists idx_extracted_financial_records_raw_entry on extracted_financial_records(raw_entry_id);
create index if not exists idx_extracted_financial_records_status on extracted_financial_records(status);
create index if not exists idx_extracted_financial_records_date on extracted_financial_records(record_date);

-- =====================================================
-- 4. Unified formal financial records table
-- =====================================================

create table if not exists financial_records (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    extracted_record_id uuid,

    type text not null check (type in ('expense', 'income', 'improvement')),
    amount numeric(12,2) not null check (amount >= 0),
    currency text not null default 'USD',
    record_date date not null,

    counterparty text,
    description text not null,

    property_id uuid not null references properties(id) on delete cascade,
    unit_id uuid references units(id) on delete set null,
    lease_id uuid,

    category_code text check (
        category_code is null or category_code in (
            'rent',
            'additional_income',
            'legal',
            'utility',
            'cleaning',
            'management',
            'maintenance',
            'repair',
            'other',
            'travel',
            'commission',
            'interest',
            'improvement',
            'insurance',
            'tax'
        )
    ),
    sub_type text,
    notes text,

    source text not null default 'manual' check (
        source in ('manual', 'voice', 'voice_openai', 'import', 'api')
    ),

    created_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_financial_records_org on financial_records(organization_id);
create index if not exists idx_financial_records_property on financial_records(property_id);
create index if not exists idx_financial_records_unit on financial_records(unit_id);
create index if not exists idx_financial_records_lease on financial_records(lease_id);
create index if not exists idx_financial_records_type on financial_records(type);
create index if not exists idx_financial_records_date on financial_records(record_date desc);
create index if not exists idx_financial_records_extracted_record on financial_records(extracted_record_id);

-- =====================================================
-- 5. Activity / audit log
-- =====================================================

create table if not exists activity_log (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    entity_type text not null,
    entity_id uuid not null,
    action text not null,
    actor_user_id uuid references users(id) on delete set null,
    metadata jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_org on activity_log(organization_id);
create index if not exists idx_activity_log_entity on activity_log(entity_type, entity_id);
create index if not exists idx_activity_log_created_at on activity_log(created_at desc);

-- =====================================================
-- 6. updated_at trigger function
-- =====================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_organizations_updated_at on organizations;
create trigger trg_organizations_updated_at
before update on organizations
for each row execute function set_updated_at();

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();

drop trigger if exists trg_properties_updated_at on properties;
create trigger trg_properties_updated_at
before update on properties
for each row execute function set_updated_at();

drop trigger if exists trg_units_updated_at on units;
create trigger trg_units_updated_at
before update on units
for each row execute function set_updated_at();

drop trigger if exists trg_renters_updated_at on renters;
create trigger trg_renters_updated_at
before update on renters
for each row execute function set_updated_at();

drop trigger if exists trg_leases_updated_at on leases;
create trigger trg_leases_updated_at
before update on leases
for each row execute function set_updated_at();

drop trigger if exists trg_raw_entries_updated_at on raw_entries;
create trigger trg_raw_entries_updated_at
before update on raw_entries
for each row execute function set_updated_at();

drop trigger if exists trg_financial_records_updated_at on financial_records;
create trigger trg_financial_records_updated_at
before update on financial_records
for each row execute function set_updated_at();

-- =====================================================
-- 7. Notes / implementation guidance
-- =====================================================

-- Recommended write path:
-- 1) Insert user-confirmed input into raw_entries
-- 2) Insert AI extraction result into extracted_financial_records
-- 3) Business layer maps property/unit/lease/category
-- 4) Insert final normalized row into financial_records
--
-- Important modeling rule:
-- - property_id is required on formal records
-- - unit_id is optional
-- This supports whole-property expenses as well as unit-specific records.
--
-- Current canonical category_code values used by app + API + DB:
-- - rent
-- - additional_income
-- - legal
-- - utility
-- - cleaning
-- - management
-- - maintenance
-- - repair
-- - other
-- - travel
-- - commission
-- - interest
-- - improvement
-- - insurance
-- - tax
--
-- Legacy aliases should be normalized on write:
-- - water -> utility
-- - utilities -> utility
-- - repairs / repair -> maintenance
-- - capital_improvements -> improvement
-- - fees / late_fee / pet_fee -> additional_income
