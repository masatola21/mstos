-- Private storage for files attached to knowledge items.
insert into storage.buckets (id, name, public, file_size_limit)
values ('mst-knowledge-files', 'mst-knowledge-files', false, 20971520)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "Users can read their own knowledge files" on storage.objects;
create policy "Users can read their own knowledge files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'mst-knowledge-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can upload their own knowledge files" on storage.objects;
create policy "Users can upload their own knowledge files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mst-knowledge-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own knowledge files" on storage.objects;
create policy "Users can delete their own knowledge files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'mst-knowledge-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

