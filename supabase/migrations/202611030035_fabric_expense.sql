begin;
insert into public.expense_categories(code,name) values('FABRIC','Mua vải may chiếu') on conflict(code) do update set name=excluded.name;
-- Fabric is part of the owner-entered material cost; do not subtract it twice.
do $$ declare definition text;begin
 select pg_get_functiondef('public.profit_report(date,text)'::regprocedure) into definition;
 definition:=replace(definition,'''SEDGE'',''THREAD'',''DYE''','''SEDGE'',''THREAD'',''DYE'',''FABRIC''');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
