begin;

update financial_records set category_code = lower(trim(category_code)) where category_code is not null;

update financial_records set category_code = 'rent'
where category_code in ('rental_income');

update financial_records set category_code = 'additional_income'
where category_code in ('income', 'other_income', 'fee', 'fees', 'late_fee', 'late_fees', 'pet_fee', 'pet_fees');

update financial_records set category_code = 'utility'
where category_code in ('utilities', 'electric', 'gas', 'trash', 'internet');

update financial_records set category_code = 'maintenance'
where category_code in ('repair', 'repairs');

update financial_records set category_code = 'management'
where category_code in ('property_management');

update financial_records set category_code = 'legal'
where category_code in ('professional', 'accounting', 'bookkeeping');

update financial_records set category_code = 'improvement'
where category_code in ('capital_improvement', 'capital_improvements', 'improvements');

update financial_records set category_code = 'tax'
where category_code in ('property_tax', 'property_taxes', 'taxes');

do $$
declare
    extracted_fk text;
    lease_fk text;
begin
    select tc.constraint_name into extracted_fk
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_name = 'financial_records'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'extracted_record_id'
    limit 1;

    if extracted_fk is not null then
        execute format('alter table financial_records drop constraint %I', extracted_fk);
    end if;

    select tc.constraint_name into lease_fk
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_name = 'financial_records'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'lease_id'
    limit 1;

    if lease_fk is not null then
        execute format('alter table financial_records drop constraint %I', lease_fk);
    end if;
end $$;

alter table financial_records drop constraint if exists financial_records_category_code_check;

alter table financial_records
add constraint financial_records_category_code_check
check (
    category_code is null or category_code in (
        'rent',
        'additional_income',
        'water',
        'legal',
        'utility',
        'cleaning',
        'management',
        'maintenance',
        'other',
        'travel',
        'improvement',
        'insurance',
        'tax'
    )
);

commit;
