begin;
alter table public.profiles add column avatar_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy avatars_upload on storage.objects for insert to authenticated with check(bucket_id='avatars' and public.is_active() and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatars_read on storage.objects for select to authenticated using(bucket_id='avatars' and public.is_active() and ((storage.foldername(name))[1]=auth.uid()::text or public.is_manager()));
create function public.update_my_avatar(p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active() then raise exception 'FORBIDDEN';end if;
 if p_path is null or p_path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$') or not exists(select 1 from storage.objects where bucket_id='avatars' and name=p_path) then raise exception 'INVALID_AVATAR';end if;
 update public.profiles set avatar_path=p_path,updated_at=now() where id=auth.uid();
end $$;
revoke all on function public.update_my_avatar(text) from public,anon,authenticated;
grant execute on function public.update_my_avatar(text) to authenticated;
notify pgrst,'reload schema';
commit;
