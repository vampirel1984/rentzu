begin;

update financial_records set category_code = 'repair'
where category_code = 'repairs';

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
        'repair',
        'other',
        'travel',
        'improvement',
        'insurance',
        'tax'
    )
);

commit;
