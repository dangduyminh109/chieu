begin;
alter table public.mat_types add column image_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mat-images','mat-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy mat_images_upload on storage.objects for insert to authenticated with check(bucket_id='mat-images' and public.is_manager() and (storage.foldername(name))[1]=auth.uid()::text);
create policy mat_images_read on storage.objects for select to authenticated using(bucket_id='mat-images');
create function public.save_mat_catalog_image(p_id uuid,p_code text,p_name text,p_dimensions text,p_description text,p_active boolean,p_sale bigint,p_weaving bigint,p_sewing bigint,p_cutting bigint,p_tying bigint,p_image_path text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;existing text;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-rates',0));
 if p_id is not null then select image_path into existing from public.mat_types where id=p_id for update;end if;
 if nullif(p_image_path,'') is not null and p_image_path is distinct from existing then
  if p_image_path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$') or not exists(select 1 from storage.objects where bucket_id='mat-images' and name=p_image_path) then raise exception 'INVALID_MAT_IMAGE';end if;
 end if;
 result:=public.save_mat_catalog(p_id,p_code,p_name,p_dimensions,p_description,p_active,p_sale,p_weaving,p_sewing,p_cutting,p_tying);
 if p_image_path is not null then update public.mat_types set image_path=nullif(p_image_path,'') where id=result;end if;
 return result;
end $$;
revoke all on function public.save_mat_catalog_image(uuid,text,text,text,text,boolean,bigint,bigint,bigint,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.save_mat_catalog_image(uuid,text,text,text,text,boolean,bigint,bigint,bigint,bigint,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
