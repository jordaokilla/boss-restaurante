-- RÉPLICA MÍNIMA DO BOSS, SÓ PARA A BASE DE TESTES.
-- Nunca correr na base do BOSS: lá estas tabelas e funções já existem, completas.
-- Tem os mesmos nomes e colunas das partes em que o restaurante toca, com regras simplificadas
-- (numeração e liquidação da Factura-Recibo). O stock e a AGT não estão aqui.

create type public.app_role as enum ('owner', 'manager', 'member', 'superadmin', 'partner', 'academy_instructor');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text,
  nif text,
  address text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  full_name text not null,
  email text not null,
  access_level text not null default 'colaborador',
  pillar text,
  email_verified boolean default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

create or replace function public.get_user_company_id(_user_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = _user_id limit 1
$$;

create or replace function public.is_owner_or_manager(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = _user_id and ur.role = 'owner'
                   and ur.company_id = public.get_user_company_id(_user_id))
      or exists (select 1 from public.profiles p where p.id = _user_id and p.access_level = 'admin');
$$;

create or replace function public.product_current_price(p_price numeric, p_promo numeric, p_until date) returns numeric
language sql stable as $$
  select case when p_promo is not null and p_promo >= 0
                   and (p_until is null or p_until >= (now() at time zone 'Africa/Luanda')::date)
              then p_promo else coalesce(p_price, 0) end
$$;

create table public.billing_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  product_type text not null default 'product',
  price numeric not null default 0,
  vat_rate numeric not null default 14,
  unit text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category text,
  tax_exemption_code text,
  track_stock boolean not null default false,
  image_url text,
  promo_price numeric,
  promo_until date,
  image_urls text[] not null default '{}'
);

create table public.billing_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  nif text not null,
  client_type text not null default 'particular',
  email text,
  phone text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.billing_clients (id),
  document_type text not null default 'FT',
  invoice_number integer not null,
  full_number text not null,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft',
  subtotal numeric not null default 0,
  total_vat numeric not null default 0,
  total numeric not null default 0,
  notes text,
  hash text,
  issued_by uuid,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payment_status text not null default 'unpaid',
  paid_amount numeric not null default 0,
  retention_rate numeric default 0,
  settlement_amount numeric default 0,
  currency text default 'AOA',
  is_self_billing boolean default false,
  submission_status text,
  global_discount_rate numeric not null default 0,
  public_token uuid not null default gen_random_uuid(),
  warehouse_id uuid references public.warehouses (id),
  created_by uuid default auth.uid()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid references public.billing_products (id) on delete set null,
  description text not null,
  quantity numeric not null,
  unit_price numeric not null,
  vat_rate numeric not null,
  subtotal numeric not null,
  vat_amount numeric not null,
  total numeric not null,
  sort_order integer,
  created_at timestamptz not null default now(),
  discount_percent numeric,
  tax_exemption_code text
);

create table public.invoice_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  user_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric not null,
  payment_date date not null,
  payment_method text not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Emissão simplificada: numera por empresa, tipo e ano, e liquida a Factura-Recibo.
create or replace function public.teste_emitir_documento() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if new.status = 'issued' and coalesce(old.status, '') <> 'issued' then
    select coalesce(max(invoice_number), 0) + 1 into v_n from public.invoices
     where company_id = new.company_id and document_type = new.document_type
       and status = 'issued' and extract(year from issue_date) = extract(year from new.issue_date);
    new.invoice_number := v_n;
    new.full_number := new.document_type || ' TESTE' || extract(year from new.issue_date)::int || '/' || v_n;
    new.issued_at := now();
    new.hash := md5(new.id::text || new.total::text);
    new.submission_status := 'pending';
    if new.document_type = 'FR' then
      new.payment_status := 'paid';
      new.paid_amount := new.total;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_teste_emitir before update on public.invoices
  for each row execute function public.teste_emitir_documento();

create or replace function public.teste_liquidar_fr() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.document_type = 'FR' and new.status = 'issued' and coalesce(old.status, '') <> 'issued' then
    insert into public.invoice_payments (invoice_id, company_id, amount, payment_date, payment_method, created_by, notes)
    values (new.id, new.company_id, new.total, new.issue_date, 'Fatura-Recibo', new.issued_by, 'Auto-liquidação FR');
  end if;
  return new;
end $$;
create trigger trg_teste_liquidar after update on public.invoices
  for each row execute function public.teste_liquidar_fr();

-- Como no BOSS, estas tabelas não se lêem directamente sem as permissões do Financeiro.
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.billing_products enable row level security;
alter table public.billing_clients enable row level security;
alter table public.warehouses enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_audit_log enable row level security;
alter table public.invoice_payments enable row level security;
