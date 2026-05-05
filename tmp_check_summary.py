import psycopg

conn = psycopg.connect('postgresql://postgres:password@localhost:5432/rentzu')
cur = conn.cursor()
cur.execute(
    """
    select
      p.name,
      count(fr.id),
      coalesce(sum(case when fr.type = 'income' then fr.amount else 0 end), 0),
      coalesce(sum(case when fr.type != 'income' then fr.amount else 0 end), 0)
    from properties p
    left join financial_records fr
      on fr.property_id = p.id
     and fr.record_date between %s and %s
    where p.organization_id = %s
    group by p.id, p.name
    order by p.name
    """,
    ('2026-01-01', '2026-12-31', 'd78c84e5-9daf-4fad-a63b-2ba05d3eb92c'),
)
print(cur.fetchall())
conn.close()
