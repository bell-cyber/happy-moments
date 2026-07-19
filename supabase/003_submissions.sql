-- 인스타그램 콘텐츠용 참여자 제출 폼
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  birth_year text not null,
  instagram text not null,
  occupation text not null,
  story text not null,
  song text,
  media_urls text[] not null default '{}',
  consent boolean not null default false,
  created_at timestamptz default now()
);

alter table public.submissions enable row level security;

create policy "Anyone can submit"
  on public.submissions for insert
  with check (true);

-- 제출된 내용은 대시보드에서만 확인 (일반 사용자는 조회 불가)

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', true)
on conflict (id) do nothing;

create policy "Anyone can upload submission media"
  on storage.objects for insert
  with check (bucket_id = 'submissions');
