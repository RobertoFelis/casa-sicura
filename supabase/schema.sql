-- SafeHome Kids: account genitore, profili bambino, gruppi e classifiche.
-- Il genitore accede con l'email; i bambini hanno solo soprannome e mascotte.

-- ---------- Profili bambino ----------
create table public.kids (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null default auth.uid() references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 16 and nickname ~ '^[A-Za-zÀ-ÿ0-9 _.-]+$'),
  mascot text not null default 'owl' check (char_length(mascot) <= 20),
  topics jsonb not null default '{}',
  finals jsonb not null default '{}',
  -- classifica globale solo se il genitore la attiva (privacy di default)
  public_rank boolean not null default false,
  stickers int not null default 0,
  gold int not null default 0,
  stars int not null default 0,
  score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kids_parent on public.kids(parent_id);
create index kids_score on public.kids(score desc);

-- I punti si calcolano qui, non nell'app: adesivi x10, adesivi d'oro x5, stelle delle sfide x20
create function public.kids_score() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.kids where parent_id = new.parent_id and id <> new.id) >= 6 then
    raise exception 'Massimo 6 profili per famiglia';
  end if;
  select least(count(*), 140), least(count(*) filter (where value = '2'), 140)
    into new.stickers, new.gold
    from jsonb_each_text(case when jsonb_typeof(new.topics) = 'object' then new.topics else '{}' end)
    where value in ('1', '2');
  select coalesce(sum(least(greatest(value::int, 0), 3)), 0)
    into new.stars
    from (select value from jsonb_each_text(case when jsonb_typeof(new.finals) = 'object' then new.finals else '{}' end)
          where value ~ '^[0-9]$' limit 20) f;
  new.score := new.stickers * 10 + new.gold * 5 + new.stars * 20;
  new.updated_at := now();
  return new;
end $$;
create trigger kids_score before insert or update on public.kids
  for each row execute function public.kids_score();

alter table public.kids enable row level security;
revoke all on public.kids from anon;
create policy "il genitore vede i suoi bambini" on public.kids for select to authenticated using (parent_id = auth.uid());
create policy "il genitore crea i suoi bambini" on public.kids for insert to authenticated with check (parent_id = auth.uid());
create policy "il genitore modifica i suoi bambini" on public.kids for update to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy "il genitore elimina i suoi bambini" on public.kids for delete to authenticated using (parent_id = auth.uid());

-- ---------- Gruppi (famiglia, amici, classe) ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 30),
  code text not null unique,
  owner_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid references public.groups on delete cascade,
  kid_id uuid references public.kids on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, kid_id)
);
-- Nessun accesso diretto: si passa solo dalle funzioni qui sotto
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
revoke all on public.groups, public.group_members from anon, authenticated;

create function public.my_kid(p_kid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kids where id = p_kid and parent_id = auth.uid());
$$;

create function public.create_group(p_name text, p_kid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid;
begin
  if not my_kid(p_kid) then raise exception 'Profilo non valido'; end if;
  if (select count(*) from groups where owner_id = auth.uid()) >= 10 then raise exception 'Hai già creato troppi gruppi'; end if;
  loop
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from groups where code = v_code);
  end loop;
  insert into groups(name, code, owner_id) values (trim(p_name), v_code, auth.uid()) returning id into v_id;
  insert into group_members(group_id, kid_id) values (v_id, p_kid);
  return v_code;
end $$;

create function public.join_group(p_code text, p_kid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not my_kid(p_kid) then raise exception 'Profilo non valido'; end if;
  select id, name into v_id, v_name from groups where code = upper(trim(p_code));
  if v_id is null then raise exception 'Codice non trovato'; end if;
  if (select count(*) from group_members where group_id = v_id) >= 60 then raise exception 'Il gruppo è pieno'; end if;
  insert into group_members(group_id, kid_id) values (v_id, p_kid) on conflict do nothing;
  return v_name;
end $$;

create function public.leave_group(p_group uuid, p_kid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not my_kid(p_kid) then raise exception 'Profilo non valido'; end if;
  delete from group_members where group_id = p_group and kid_id = p_kid;
  delete from groups g where g.id = p_group and not exists (select 1 from group_members m where m.group_id = g.id);
end $$;

create function public.my_groups(p_kid uuid)
returns table(id uuid, name text, code text, members int)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.code, (select count(*)::int from group_members m2 where m2.group_id = g.id)
  from groups g join group_members m on m.group_id = g.id
  where m.kid_id = p_kid and my_kid(p_kid)
  order by g.created_at;
$$;

-- ---------- Classifiche: solo soprannome, mascotte e punti ----------
create function public.leaderboard_global()
returns table(pos int, nickname text, mascot text, score int, stickers int, stars int, mine boolean)
language sql stable security definer set search_path = public as $$
  with r as (
    select rank() over (order by k.score desc)::int pos, k.nickname, k.mascot, k.score, k.stickers, k.stars,
           k.parent_id = auth.uid() mine
    from kids k where k.score > 0 and (k.public_rank or k.parent_id = auth.uid())
  )
  select * from r where pos <= 50 or mine order by pos, nickname;
$$;

create function public.leaderboard_group(p_group uuid, p_kid uuid)
returns table(pos int, nickname text, mascot text, score int, stickers int, stars int, mine boolean)
language sql stable security definer set search_path = public as $$
  select rank() over (order by k.score desc)::int, k.nickname, k.mascot, k.score, k.stickers, k.stars,
         k.parent_id = auth.uid()
  from group_members m join kids k on k.id = m.kid_id
  where m.group_id = p_group and my_kid(p_kid)
    and exists (select 1 from group_members x where x.group_id = p_group and x.kid_id = p_kid)
  order by 1, 2;
$$;

-- Il genitore può cancellare tutti i dati della famiglia
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.my_kid, public.create_group, public.join_group, public.leave_group,
  public.my_groups, public.leaderboard_global, public.leaderboard_group, public.delete_my_account from public, anon;
grant execute on function public.my_kid, public.create_group, public.join_group, public.leave_group,
  public.my_groups, public.leaderboard_global, public.leaderboard_group, public.delete_my_account to authenticated;
