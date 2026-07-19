-- 행복한 순간 기록 테이블
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text,
  tag text,
  captured_at date not null,
  created_at timestamptz default now()
);

alter table public.moments enable row level security;

create policy "Users can view their own moments"
  on public.moments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own moments"
  on public.moments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own moments"
  on public.moments for delete
  using (auth.uid() = user_id);

-- 사진/영상 저장용 스토리지 버킷
insert into storage.buckets (id, name, public)
values ('moments', 'moments', true)
on conflict (id) do nothing;

create policy "Users can upload their own media"
  on storage.objects for insert
  with check (bucket_id = 'moments' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own media"
  on storage.objects for delete
  using (bucket_id = 'moments' and auth.uid()::text = (storage.foldername(name))[1]);
