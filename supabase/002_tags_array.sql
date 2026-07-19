-- tag(단일) -> tags(여러 개 배열)로 변경
alter table public.moments add column tags text[] default '{}';
update public.moments set tags = array[tag] where tag is not null;
alter table public.moments drop column tag;
