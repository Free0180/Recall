begin;

-- Prefix this app's objects to coexist with an existing Supabase project.
create table public.pet_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^(FREE[12]|RUN([1-9]|10))$'),
  role text not null check (role in ('admin', 'learner')),
  check ((role = 'admin') = (username in ('FREE1', 'FREE2')))
);
create table public.pet_learning_snapshots (
  user_id uuid primary key references public.pet_profiles(user_id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  payload text not null check (octet_length(payload) <= 4194304),
  updated_at timestamptz not null default now()
);
create table public.pet_word_progress (
  user_id uuid not null references public.pet_profiles(user_id) on delete cascade,
  word_id integer not null,
  rating text not null check (rating in ('again', 'learning', 'known')),
  primary key (user_id, word_id)
);
create table public.pet_review_records (
  user_id uuid not null references public.pet_profiles(user_id) on delete cascade,
  position integer not null,
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  primary key (user_id, position)
);
create table public.pet_user_settings (
  user_id uuid primary key references public.pet_profiles(user_id) on delete cascade,
  speech jsonb not null default '{}' check (jsonb_typeof(speech) = 'object')
);

alter table public.pet_profiles enable row level security;
alter table public.pet_learning_snapshots enable row level security;
alter table public.pet_word_progress enable row level security;
alter table public.pet_review_records enable row level security;
alter table public.pet_user_settings enable row level security;
revoke all on public.pet_profiles, public.pet_learning_snapshots, public.pet_word_progress, public.pet_review_records, public.pet_user_settings from public, anon, authenticated;
grant select on public.pet_profiles, public.pet_learning_snapshots, public.pet_word_progress, public.pet_review_records, public.pet_user_settings to authenticated;
create policy own_profile on public.pet_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy own_snapshot on public.pet_learning_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy own_words on public.pet_word_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy own_reviews on public.pet_review_records for select to authenticated using ((select auth.uid()) = user_id);
create policy own_settings on public.pet_user_settings for select to authenticated using ((select auth.uid()) = user_id);

-- Only already-created, fixed Auth users are enrolled. Clients cannot assign roles.
insert into public.pet_profiles (user_id, username, role)
select id, upper(split_part(email, '@', 1)),
  case when lower(split_part(email, '@', 1)) in ('free1', 'free2') then 'admin' else 'learner' end
from auth.users where lower(email) ~ '^(free[12]|run([1-9]|10))@pet-vocab\.invalid$';

create function public.pet_save_learning(expected_user uuid, expected_revision integer, next_payload text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_revision integer;
  body jsonb;
  result jsonb;
begin
  if uid is null or uid is distinct from expected_user then raise exception 'Unauthorized' using errcode = '42501'; end if;
  -- The profile row also serializes competing first writes to a missing snapshot.
  perform 1 from public.pet_profiles where user_id = uid for update;
  if not found then raise exception 'Account not enrolled' using errcode = '42501'; end if;
  if next_payload is null or octet_length(next_payload) > 4194304 then raise exception 'Invalid payload'; end if;
  body := next_payload::jsonb;
  if jsonb_typeof(body) is distinct from 'object'
    or jsonb_typeof(body->'ratings') is distinct from 'object'
    or jsonb_typeof(body->'reviews') is distinct from 'array'
    or jsonb_array_length(body->'reviews') > 500
    or jsonb_typeof(coalesce(body->'speech', '{}'::jsonb)) is distinct from 'object'
  then raise exception 'Invalid learning data'; end if;
  select revision into current_revision from public.pet_learning_snapshots where user_id = uid;
  if expected_revision is distinct from coalesce(current_revision, 0) then return null; end if;
  insert into public.pet_learning_snapshots (user_id, revision, payload)
  values (uid, 1, next_payload)
  on conflict (user_id) do update set revision = pet_learning_snapshots.revision + 1, payload = excluded.payload, updated_at = now()
  returning jsonb_build_object('revision', revision, 'payload', payload) into result;
  -- Projections and the complete plan commit in one transaction.
  delete from public.pet_word_progress where user_id = uid;
  insert into public.pet_word_progress select uid, key::integer, value from jsonb_each_text(body->'ratings');
  delete from public.pet_review_records where user_id = uid;
  insert into public.pet_review_records select uid, ordinal::integer, value from jsonb_array_elements(body->'reviews') with ordinality as r(value, ordinal);
  insert into public.pet_user_settings values (uid, coalesce(body->'speech', '{}'::jsonb))
  on conflict (user_id) do update set speech = excluded.speech;
  return result;
end;
$$;
revoke all on function public.pet_save_learning(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.pet_save_learning(uuid, integer, text) to authenticated;

-- Admins receive aggregates only, never another user's raw snapshot or credentials.
create function public.pet_learning_summary()
returns table(username text, studied bigint, known bigint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pet_profiles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  return query select p.username, count(w.word_id), count(w.word_id) filter (where w.rating = 'known'), s.updated_at
  from public.pet_profiles p left join public.pet_word_progress w on w.user_id = p.user_id
  left join public.pet_learning_snapshots s on s.user_id = p.user_id
  group by p.username, s.updated_at order by p.username;
end;
$$;
revoke all on function public.pet_learning_summary() from public, anon, authenticated;
grant execute on function public.pet_learning_summary() to authenticated;
commit;
