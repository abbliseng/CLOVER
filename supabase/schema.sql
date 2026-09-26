-- Clover schema for Supabase (run once in the SQL editor).
-- Every table is local-first: rows are never deleted, only flagged, and updated_at drives sync.

create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key,
  name text not null,
  currency text not null default 'SEK',
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.members (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  auth_user_id uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.quick_titles (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  text text not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.expenses (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  amount_ore bigint not null,
  date date not null,
  paid_by uuid not null,
  shares jsonb not null default '[]'::jsonb,
  is_settlement boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create index if not exists members_group_idx on public.members (group_id);
create index if not exists quick_titles_group_idx on public.quick_titles (group_id);
create index if not exists expenses_group_idx on public.expenses (group_id);
create index if not exists groups_updated_idx on public.groups (updated_at);
create index if not exists members_updated_idx on public.members (updated_at);
create index if not exists quick_titles_updated_idx on public.quick_titles (updated_at);
create index if not exists expenses_updated_idx on public.expenses (updated_at);
create unique index if not exists quick_titles_unique_per_group
  on public.quick_titles (group_id, lower(text)) where not deleted;
create unique index if not exists members_one_account_per_group
  on public.members (group_id, auth_user_id) where auth_user_id is not null;

create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.group_id = p_group and m.auth_user_id = auth.uid() and not m.deleted
  );
$$;

-- Must be security definer as well: a policy on members may not query members directly.
create or replace function public.group_is_unclaimed(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.members m
    where m.group_id = p_group and m.auth_user_id is not null
  );
$$;

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.quick_titles enable row level security;
alter table public.expenses enable row level security;

-- groups: readable and writable by its members. A group where nobody has claimed a seat is
-- still being created, so its creator can finish writing it.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using (is_group_member(id) or group_is_unclaimed(id));
drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert to authenticated with check (true);
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using (is_group_member(id) or group_is_unclaimed(id))
  with check (is_group_member(id) or group_is_unclaimed(id));

-- members: members of the group may add and edit people, and the creator may add the first batch.
drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (is_group_member(group_id) or group_is_unclaimed(group_id));
drop policy if exists members_insert on public.members;
create policy members_insert on public.members for insert to authenticated
  with check (is_group_member(group_id) or group_is_unclaimed(group_id));
drop policy if exists members_update on public.members;
create policy members_update on public.members for update to authenticated
  using (is_group_member(group_id) or group_is_unclaimed(group_id))
  with check (is_group_member(group_id) or group_is_unclaimed(group_id));

drop policy if exists quick_titles_all on public.quick_titles;
create policy quick_titles_all on public.quick_titles for all to authenticated
  using (is_group_member(group_id)) with check (is_group_member(group_id));

drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses for all to authenticated
  using (is_group_member(group_id)) with check (is_group_member(group_id));

-- Joining: the group id doubles as the invite code. A new phone looks the group up,
-- picks an unclaimed person and links it to its own account.
create or replace function public.group_preview(p_group uuid)
returns table (group_name text, member_id uuid, member_name text, claimed boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.name, m.id, m.name, m.auth_user_id is not null
  from public.groups g
  join public.members m on m.group_id = g.id and not m.deleted
  where g.id = p_group and not g.deleted
  order by m.name;
$$;

create or replace function public.claim_member(p_group uuid, p_member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.members
    where group_id = p_group and auth_user_id = auth.uid() and id <> p_member
  ) then
    raise exception 'Kontot är redan kopplat till någon annan i gruppen';
  end if;

  update public.members
  set auth_user_id = auth.uid(), updated_at = now()
  where id = p_member and group_id = p_group and (auth_user_id is null or auth_user_id = auth.uid());

  if not found then
    raise exception 'Personen är redan upptagen';
  end if;
end;
$$;

revoke all on function public.group_preview(uuid) from public, anon;
revoke all on function public.claim_member(uuid, uuid) from public, anon;
grant execute on function public.group_preview(uuid) to authenticated;
grant execute on function public.claim_member(uuid, uuid) to authenticated;
