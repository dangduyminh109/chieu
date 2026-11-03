begin;
-- Preserve existing entry point but forbid destructive catalog operations.
create or replace function public.delete_mat(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 raise exception 'DELETION_DISABLED';
end $$;
revoke execute on function public.delete_mat(uuid) from public,anon,authenticated,service_role;
commit;
