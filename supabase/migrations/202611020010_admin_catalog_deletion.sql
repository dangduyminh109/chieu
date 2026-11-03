begin;
-- Catalog deletion is ADMIN-only; existing foreign keys protect historical records.
create or replace function public.delete_mat(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.has_role('ADMIN') then raise exception 'FORBIDDEN';end if;
 delete from public.mat_types where id=p_id;
 if not found then raise exception 'NOT_FOUND';end if;
end $$;
revoke all on function public.delete_mat(uuid) from public,anon,authenticated,service_role;
grant execute on function public.delete_mat(uuid) to authenticated;
commit;
