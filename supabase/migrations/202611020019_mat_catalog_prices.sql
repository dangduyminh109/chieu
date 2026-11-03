begin;
-- Price changes can have multiple revisions on a business date; transactions retain snapshots.
drop index public.default_rate_date;
drop index public.worker_rate_date;
drop index public.stage_default_rate_date;
drop index public.stage_worker_rate_date;
alter table public.mat_price_history drop constraint mat_price_history_mat_type_id_price_type_effective_from_key;
create index labor_rate_revision on public.labor_rate_history(stage_id,mat_type_id,worker_id,effective_from desc,created_at desc);
create index mat_price_revision on public.mat_price_history(mat_type_id,price_type,effective_from desc,created_at desc);
do $$ declare f record;definition text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('submit_work','resubmit_work','post_document') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'effective_from desc limit 1','effective_from desc,created_at desc,id desc limit 1');
  execute definition;
 end loop;
end $$;

create function public.save_mat_catalog(p_id uuid,p_code text,p_name text,p_dimensions text,p_description text,p_active boolean,p_sale bigint,p_weaving bigint,p_sewing bigint,p_cutting bigint,p_tying bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;s record;price bigint;current_price bigint;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_sale is null or p_weaving is null or p_sewing is null or p_cutting is null or p_tying is null or least(p_sale,p_weaving,p_sewing,p_cutting,p_tying)<0 or greatest(p_sale,p_weaving,p_sewing,p_cutting,p_tying)>1000000000 then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-rates',0));
 result:=public.save_mat(p_id,coalesce(nullif(p_code,''),'CHIEU_'||substr(replace(gen_random_uuid()::text,'-',''),1,12)),p_name,p_dimensions,p_description,p_active);
 for s in select unnest(array['RETAIL','WHOLESALE']) kind loop
  select unit_price into current_price from public.mat_price_history where mat_type_id=result and price_type=s.kind and effective_from<=today order by effective_from desc,created_at desc,id desc limit 1;
  if current_price is distinct from p_sale then insert into public.mat_price_history(mat_type_id,price_type,effective_from,unit_price,created_by) values(result,s.kind,today,p_sale,auth.uid());end if;
 end loop;
 for s in select id,code from public.production_stages where code in ('WEAVING','SEWING','CUTTING','TYING') loop
  price:=case s.code when 'WEAVING' then p_weaving when 'SEWING' then p_sewing when 'CUTTING' then p_cutting else p_tying end;
  select unit_rate into current_price from public.labor_rate_history where stage_id=s.id and mat_type_id is not distinct from (case when s.code='WEAVING' then result else null end) and worker_id is null and effective_from<=today order by effective_from desc,created_at desc,id desc limit 1;
  if current_price is distinct from price then insert into public.labor_rate_history(mat_type_id,stage_id,effective_from,unit_rate,created_by) values(case when s.code='WEAVING' then result else null end,s.id,today,price,auth.uid());end if;
 end loop;return result;
end $$;
revoke all on function public.save_mat_catalog(uuid,text,text,text,text,boolean,bigint,bigint,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.save_mat_catalog(uuid,text,text,text,text,boolean,bigint,bigint,bigint,bigint,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
