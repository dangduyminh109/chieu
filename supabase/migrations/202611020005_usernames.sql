begin;
alter table public.profiles add column username text;
alter table public.profiles add constraint profiles_username_format check(username is null or username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$');
create unique index profiles_username_unique on public.profiles(lower(username)) where username is not null;
-- Initial administrator's requested login alias; no password changes.
update public.profiles set username='dangduyminh109',updated_at=now() where email='dangduyminh109@gmail.com' and username is null;
notify pgrst, 'reload schema';
commit;
