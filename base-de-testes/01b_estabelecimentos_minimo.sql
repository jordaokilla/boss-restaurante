-- RÉPLICA MÍNIMA DOS ESTABELECIMENTOS DO BOSS, SÓ PARA A BASE DE TESTES.
-- Nunca correr na base do BOSS: lá vivem completos (migrações 20270114090000 a 20270115100000 do appbossao).
-- Aqui estão as tabelas e as funções em que o restaurante toca, com os mesmos nomes: as casas, a equipa de cada
-- uma, a casa em que cada pessoa está a trabalhar e a casa de cada factura. Ficam de fora o piloto, os armazéns,
-- a regra que decide a casa de um documento do BOSS e as políticas de leitura das facturas por casa.
-- Corre depois de 01_nucleo_boss_minimo.sql e antes das migrações do restaurante por estabelecimento.

create table if not exists public.establishments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  code text not null check (code ~ '^[A-Z0-9]{2,10}$'),
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);
create unique index if not exists establishments_company_name_key on public.establishments (company_id, lower(name));

create table if not exists public.establishment_members (
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (establishment_id, user_id)
);
create index if not exists establishment_members_user_idx on public.establishment_members (user_id, company_id);

-- A empresa da linha é sempre a da casa (nunca a que o ecrã mandar).
create or replace function public.establishment_members_validate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select e.company_id into new.company_id from public.establishments e where e.id = new.establishment_id;
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.company_id = new.company_id) then
    raise exception 'Essa pessoa não pertence a esta empresa.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_establishment_members_validate on public.establishment_members;
create trigger trg_establishment_members_validate before insert or update on public.establishment_members
  for each row execute function public.establishment_members_validate();

create table if not exists public.establishment_selection (
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

alter table public.invoices add column if not exists establishment_id uuid references public.establishments (id);

alter table public.establishments enable row level security;
alter table public.establishment_members enable row level security;
alter table public.establishment_selection enable row level security;
revoke all on public.establishment_selection from anon, authenticated;
grant select, insert, update on public.establishments to authenticated;
grant select, insert, delete on public.establishment_members to authenticated;

drop policy if exists "Company members read establishments" on public.establishments;
create policy "Company members read establishments" on public.establishments for select to authenticated
  using (company_id = (select public.get_user_company_id((select auth.uid()))));
drop policy if exists "Owners and admins create establishments" on public.establishments;
create policy "Owners and admins create establishments" on public.establishments for insert to authenticated
  with check (company_id = (select public.get_user_company_id((select auth.uid()))) and (select public.is_owner_or_manager((select auth.uid()))));
drop policy if exists "Owners and admins update establishments" on public.establishments;
create policy "Owners and admins update establishments" on public.establishments for update to authenticated
  using (company_id = (select public.get_user_company_id((select auth.uid()))) and (select public.is_owner_or_manager((select auth.uid()))))
  with check (company_id = (select public.get_user_company_id((select auth.uid()))));

drop policy if exists "Company members read establishment teams" on public.establishment_members;
create policy "Company members read establishment teams" on public.establishment_members for select to authenticated
  using (company_id = (select public.get_user_company_id((select auth.uid()))));
drop policy if exists "Owners and admins add establishment members" on public.establishment_members;
create policy "Owners and admins add establishment members" on public.establishment_members for insert to authenticated
  with check (company_id = (select public.get_user_company_id((select auth.uid()))) and (select public.is_owner_or_manager((select auth.uid()))));
drop policy if exists "Owners and admins remove establishment members" on public.establishment_members;
create policy "Owners and admins remove establishment members" on public.establishment_members for delete to authenticated
  using (company_id = (select public.get_user_company_id((select auth.uid()))) and (select public.is_owner_or_manager((select auth.uid()))));

-- As funções são as do BOSS, iguais.
create or replace function public.establishment_scope_of(_user uuid, _company uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select case
           when s.houses is null then null
           -- Quem gere a empresa nunca fica preso, mesmo que esteja na equipa de uma casa.
           when public.get_user_company_id(_user) = _company and public.is_owner_or_manager(_user) then null
           else s.houses
         end
    from (select array_agg(m.establishment_id) as houses
            from public.establishment_members m
           where m.user_id = _user and m.company_id = _company) s;
$$;

create or replace function public.establishment_scope() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select case
           when not exists (select 1 from public.establishment_members m where m.user_id = auth.uid()) then null
           else public.establishment_scope_of(auth.uid(), public.get_user_company_id(auth.uid()))
         end;
$$;

create or replace function public.establishment_working_house(_user uuid, _company uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope uuid[];
  v_house uuid;
  v_mine  uuid[];
begin
  if _user is null or _company is null then
    return null;
  end if;
  v_scope := public.establishment_scope_of(_user, _company);

  select s.establishment_id into v_house
    from public.establishment_selection s
    join public.establishments e on e.id = s.establishment_id and e.company_id = _company and e.is_active
   where s.user_id = _user and s.company_id = _company
     and (v_scope is null or s.establishment_id = any (v_scope));
  if v_house is not null then
    return v_house;
  end if;

  select array_agg(m.establishment_id) into v_mine
    from public.establishment_members m
    join public.establishments e on e.id = m.establishment_id and e.is_active
   where m.user_id = _user and m.company_id = _company;
  if array_length(v_mine, 1) = 1 then
    return v_mine[1];
  end if;
  return null;
end $$;

create or replace function public.establishment_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_company uuid := public.get_user_company_id(auth.uid());
  v_scope   uuid[];
begin
  if v_uid is null or v_company is null
     or not exists (select 1 from public.establishments e where e.company_id = v_company) then
    return jsonb_build_object('restricted', false, 'houses', '[]'::jsonb, 'working', null);
  end if;
  v_scope := public.establishment_scope_of(v_uid, v_company);
  return jsonb_build_object(
    'restricted', v_scope is not null,
    'houses', coalesce((select jsonb_agg(e.id order by e.name)
                          from public.establishments e
                         where e.company_id = v_company and e.is_active
                           and (v_scope is null or e.id = any (v_scope))), '[]'::jsonb),
    'working', public.establishment_working_house(v_uid, v_company)
  );
end $$;

create or replace function public.establishment_select(_establishment uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_company uuid := public.get_user_company_id(auth.uid());
  v_scope   uuid[];
begin
  if v_uid is null or v_company is null then
    raise exception 'Sessão em falta: entre de novo para continuar.' using errcode = '42501';
  end if;
  if _establishment is null then
    delete from public.establishment_selection where user_id = v_uid and company_id = v_company;
    return public.establishment_context();
  end if;
  if not exists (
    select 1 from public.establishments e where e.id = _establishment and e.company_id = v_company and e.is_active
  ) then
    raise exception 'Esse estabelecimento não existe nesta empresa ou está desactivado.' using errcode = '23514';
  end if;
  v_scope := public.establishment_scope_of(v_uid, v_company);
  if v_scope is not null and not _establishment = any (v_scope) then
    raise exception 'Só pode trabalhar nos estabelecimentos em que está na equipa.' using errcode = '42501';
  end if;
  insert into public.establishment_selection (user_id, company_id, establishment_id)
  values (v_uid, v_company, _establishment)
  on conflict (user_id, company_id)
  do update set establishment_id = excluded.establishment_id, updated_at = now();
  return public.establishment_context();
end $$;

revoke all on function public.establishment_scope_of(uuid, uuid), public.establishment_working_house(uuid, uuid) from public, anon;
revoke all on function public.establishment_scope(), public.establishment_context(), public.establishment_select(uuid) from public, anon;
grant execute on function public.establishment_scope_of(uuid, uuid), public.establishment_working_house(uuid, uuid),
  public.establishment_scope(), public.establishment_context(), public.establishment_select(uuid) to authenticated, service_role;
