-- =============================================================================
-- Buffet Magic Star — Área do Gestor
-- Banco de dados (Supabase / Postgres)
--
-- Como usar: no painel do Supabase, abra "SQL Editor" → "New query",
-- cole este arquivo inteiro e clique em "Run". Pode ser executado de novo
-- sem perder dados (usa "if not exists" / "create or replace").
--
-- Segurança: todas as tabelas têm RLS (Row Level Security). As permissões
-- valem no próprio banco, então nem um usuário curioso no navegador
-- consegue ler o que o nível de acesso dele não permite.
--
-- Níveis: pendente < funcionario < gerente < admin
--   pendente     — criou conta, aguarda liberação de um administrador
--   funcionario  — clientes, orçamentos, agenda e checklist (sem financeiro)
--   gerente      — tudo acima + financeiro, catálogo, relatórios, festas
--   admin        — tudo + usuários, configurações e exclusões
-- O PRIMEIRO usuário cadastrado vira administrador automaticamente.
-- =============================================================================

create extension if not exists btree_gist;

-- ---------- Tipos ----------
do $$ begin
  create type public.user_role as enum ('pendente', 'funcionario', 'gerente', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.quote_status as enum ('em_elaboracao', 'enviado', 'aguardando_resposta', 'em_negociacao', 'aprovado', 'recusado', 'expirado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.event_status as enum ('aguardando_confirmacao', 'confirmada', 'realizada', 'cancelada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.catalog_category as enum ('pacote', 'cardapio', 'bebida', 'decoracao', 'tema', 'recreacao', 'atracao', 'servico', 'personalizado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_kind as enum ('entrada', 'parcela', 'extra', 'desconto', 'reembolso');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.lead_status as enum ('novo', 'em_contato', 'convertido', 'descartado');
exception when duplicate_object then null; end $$;

-- ---------- Funções utilitárias ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =============================================================================
-- USUÁRIOS E PERMISSÕES
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role public.user_role not null default 'pendente',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Nível do usuário logado (inativo = pendente)
create or replace function public.app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid() and active), 'pendente'::public.user_role)
$$;

create or replace function public.has_role(min_role public.user_role) returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_role() >= min_role
$$;

-- Cria o perfil quando alguém se cadastra. O primeiro vira admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    case when exists (select 1 from public.profiles where role = 'admin') then 'pendente'::public.user_role else 'admin'::public.user_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Só admin muda nível/ativação; ninguém remove o último admin
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active) then
    if public.app_role() <> 'admin' then
      raise exception 'Apenas administradores podem alterar níveis de acesso.';
    end if;
    if old.role = 'admin' and (new.role <> 'admin' or not new.active)
       and (select count(*) from public.profiles where role = 'admin' and active and id <> old.id) = 0 then
      raise exception 'O sistema precisa de pelo menos um administrador ativo.';
    end if;
  end if;
  new.id = old.id; new.email = old.email;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role('funcionario'));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));

-- =============================================================================
-- CONFIGURAÇÕES DO BUFFET (uma única linha)
-- =============================================================================
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  buffet_name text not null default 'Buffet Magic Star',
  legal_name text default '',
  document text default '',
  logo_url text default '',
  address text default 'Rua Oriente, 931 – Barcelona, São Caetano do Sul – SP',
  phone text default '(11) 94531-0974',
  whatsapp text default '5511945310974',
  email text default '',
  instagram text default '@buffetmagicstar',
  facebook text default '',
  website text default '',
  payment_methods text[] not null default array['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência bancária'],
  quote_validity_days int not null default 15 check (quote_validity_days between 1 and 365),
  quote_intro text default 'Ficamos muito felizes em fazer parte deste momento. Preparamos esta proposta com carinho para a festa de aniversário.',
  quote_terms text default 'A data é reservada somente após o pagamento da entrada. Valores sujeitos a alteração caso o número de convidados mude.',
  quote_footer text default 'Qualquer dúvida, estamos à disposição pelo WhatsApp.',
  default_start_time time not null default '14:00',
  default_duration_hours numeric(4,1) not null default 4,
  max_events_per_day int not null default 2 check (max_events_per_day >= 1),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
alter table public.settings enable row level security;
drop trigger if exists settings_updated on public.settings;
create trigger settings_updated before update on public.settings for each row execute function public.set_updated_at();
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated using (public.has_role('funcionario'));
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- =============================================================================
-- CLIENTES (CRM)
-- =============================================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  responsible_name text not null check (char_length(trim(responsible_name)) between 2 and 160),
  phone text not null default '',
  email text default '',
  child_name text default '',
  child_age text default '',
  desired_date date,
  guests int check (guests is null or guests between 1 and 5000),
  source text default '',
  notes text default '',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_name_idx on public.clients (lower(responsible_name));
alter table public.clients enable row level security;
drop trigger if exists clients_updated on public.clients;
create trigger clients_updated before update on public.clients for each row execute function public.set_updated_at();
drop policy if exists clients_rw on public.clients;
create policy clients_rw on public.clients for select to authenticated using (public.has_role('funcionario'));
drop policy if exists clients_ins on public.clients;
create policy clients_ins on public.clients for insert to authenticated with check (public.has_role('funcionario'));
drop policy if exists clients_upd on public.clients;
create policy clients_upd on public.clients for update to authenticated using (public.has_role('funcionario')) with check (public.has_role('funcionario'));
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (public.has_role('admin'));

-- Histórico de atendimento (ligações, visitas, mensagens, anotações)
create table if not exists public.client_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null default 'nota',
  note text not null check (char_length(note) between 1 and 4000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists interactions_client_idx on public.client_interactions (client_id, created_at desc);
alter table public.client_interactions enable row level security;
drop policy if exists interactions_rw on public.client_interactions;
create policy interactions_rw on public.client_interactions for all to authenticated
  using (public.has_role('funcionario')) with check (public.has_role('funcionario'));

-- =============================================================================
-- INTERESSADOS VINDOS DO SITE (formulário público)
-- =============================================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  phone text not null,
  child_name text default '',
  child_age text default '',
  event_date date,
  guests int,
  message text default '',
  source text not null default 'site',
  status public.lead_status not null default 'novo',
  client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
-- O visitante do site só consegue INSERIR um pedido novo; não lê nada
drop policy if exists leads_public_insert on public.leads;
create policy leads_public_insert on public.leads for insert to anon, authenticated
  with check (
    status = 'novo' and client_id is null
    and char_length(trim(parent_name)) between 2 and 120
    and char_length(phone) between 8 and 30
    and char_length(coalesce(message, '')) <= 2000
    and char_length(coalesce(child_name, '')) <= 120
    and (guests is null or guests between 1 and 5000)
  );
drop policy if exists leads_staff on public.leads;
create policy leads_staff on public.leads for select to authenticated using (public.has_role('funcionario'));
drop policy if exists leads_staff_update on public.leads;
create policy leads_staff_update on public.leads for update to authenticated
  using (public.has_role('funcionario')) with check (public.has_role('funcionario'));
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete to authenticated using (public.has_role('admin'));

-- =============================================================================
-- CATÁLOGO: pacotes, cardápios, decorações, temas, atrações, serviços
-- =============================================================================
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text default '',
  category public.catalog_category not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  unit text not null default 'festa' check (unit in ('festa', 'convidado', 'hora', 'unidade')),
  image_url text default '',
  available boolean not null default true,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.catalog_items enable row level security;
drop trigger if exists catalog_updated on public.catalog_items;
create trigger catalog_updated before update on public.catalog_items for each row execute function public.set_updated_at();
drop policy if exists catalog_select on public.catalog_items;
create policy catalog_select on public.catalog_items for select to authenticated using (public.has_role('funcionario'));
drop policy if exists catalog_write on public.catalog_items;
create policy catalog_write on public.catalog_items for insert to authenticated with check (public.has_role('gerente'));
drop policy if exists catalog_update on public.catalog_items;
create policy catalog_update on public.catalog_items for update to authenticated using (public.has_role('gerente')) with check (public.has_role('gerente'));
drop policy if exists catalog_delete on public.catalog_items;
create policy catalog_delete on public.catalog_items for delete to authenticated using (public.has_role('gerente'));

-- =============================================================================
-- ORÇAMENTOS
-- =============================================================================
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  version int not null default 1,
  root_id uuid references public.quotes (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete restrict,
  status public.quote_status not null default 'em_elaboracao',
  child_name text default '',
  child_age text default '',
  theme text default '',
  event_date date,
  start_time time,
  duration_hours numeric(4,1) default 4 check (duration_hours is null or duration_hours between 0.5 and 24),
  guests int check (guests is null or guests between 1 and 5000),
  subtotal numeric(12,2) not null default 0,
  discount_type text not null default 'valor' check (discount_type in ('valor', 'percentual')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(12,2) not null default 0,
  fees_value numeric(12,2) not null default 0 check (fees_value >= 0),
  fees_description text default '',
  total numeric(12,2) not null default 0,
  down_payment numeric(12,2) not null default 0 check (down_payment >= 0),
  installments int not null default 1 check (installments between 0 and 48),
  payment_methods text[] not null default '{}',
  payment_notes text default '',
  notes text default '',
  internal_notes text default '',
  valid_until date,
  loss_reason text default '',
  share_token uuid not null default gen_random_uuid() unique,
  sent_at timestamptz,
  approved_at timestamptz,
  accepted_name text default '',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotes_client_idx on public.quotes (client_id);
create index if not exists quotes_status_idx on public.quotes (status);
alter table public.quotes enable row level security;

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  catalog_item_id uuid references public.catalog_items (id) on delete set null,
  category public.catalog_category not null default 'personalizado',
  description text not null check (char_length(trim(description)) between 1 and 300),
  details text default '',
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  position int not null default 0
);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id, position);
alter table public.quote_items enable row level security;

create table if not exists public.quote_installments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  n int not null,                         -- 0 = entrada; 1..N = parcelas
  due_date date,
  amount numeric(12,2) not null check (amount >= 0)
);
create index if not exists quote_inst_quote_idx on public.quote_installments (quote_id, n);
alter table public.quote_installments enable row level security;

create table if not exists public.quote_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  action text not null,
  details text default '',
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quote_history_idx on public.quote_history (quote_id, created_at desc);
alter table public.quote_history enable row level security;

-- Totais do orçamento sempre calculados no banco
create or replace function public.quote_compute_totals() returns trigger
language plpgsql as $$
begin
  new.discount_amount = case
    when new.discount_type = 'percentual' then round(new.subtotal * least(new.discount_value, 100) / 100, 2)
    else least(new.discount_value, new.subtotal) end;
  new.total = greatest(0, new.subtotal - new.discount_amount + new.fees_value);
  new.updated_at = now();
  if new.status in ('enviado', 'aguardando_resposta') and new.sent_at is null then new.sent_at = now(); end if;
  if new.status = 'aprovado' and new.approved_at is null then new.approved_at = now(); end if;
  return new;
end $$;
drop trigger if exists quotes_totals on public.quotes;
create trigger quotes_totals before insert or update on public.quotes
  for each row execute function public.quote_compute_totals();

create or replace function public.quote_items_resum() returns trigger
language plpgsql security definer set search_path = public as $$
declare qid uuid := coalesce(new.quote_id, old.quote_id);
begin
  update public.quotes set subtotal = coalesce((select sum(total) from public.quote_items where quote_id = qid), 0)
  where id = qid;
  return null;
end $$;
drop trigger if exists quote_items_sum on public.quote_items;
create trigger quote_items_sum after insert or update or delete on public.quote_items
  for each row execute function public.quote_items_resum();

-- Histórico automático: criação e mudança de status (edições são registradas pelo painel)
create or replace function public.quote_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.quote_history (quote_id, action, details) values (new.id, 'Orçamento criado', 'Versão ' || new.version);
  else
    if new.status is distinct from old.status then
      insert into public.quote_history (quote_id, action, details) values (new.id, 'Status alterado', old.status || ' → ' || new.status);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists quotes_log on public.quotes;
create trigger quotes_log after insert or update on public.quotes
  for each row execute function public.quote_log();

drop policy if exists quotes_rw on public.quotes;
create policy quotes_rw on public.quotes for select to authenticated using (public.has_role('funcionario'));
drop policy if exists quotes_ins on public.quotes;
create policy quotes_ins on public.quotes for insert to authenticated with check (public.has_role('funcionario'));
drop policy if exists quotes_upd on public.quotes;
create policy quotes_upd on public.quotes for update to authenticated using (public.has_role('funcionario')) with check (public.has_role('funcionario'));
drop policy if exists quotes_del on public.quotes;
create policy quotes_del on public.quotes for delete to authenticated using (public.has_role('admin'));

drop policy if exists quote_items_rw on public.quote_items;
create policy quote_items_rw on public.quote_items for all to authenticated
  using (public.has_role('funcionario')) with check (public.has_role('funcionario'));
drop policy if exists quote_inst_rw on public.quote_installments;
create policy quote_inst_rw on public.quote_installments for all to authenticated
  using (public.has_role('funcionario')) with check (public.has_role('funcionario'));
drop policy if exists quote_history_select on public.quote_history;
create policy quote_history_select on public.quote_history for select to authenticated using (public.has_role('funcionario'));
drop policy if exists quote_history_insert on public.quote_history;
create policy quote_history_insert on public.quote_history for insert to authenticated with check (public.has_role('funcionario'));

-- Duplicar orçamento ou criar nova versão (copia itens e parcelas)
create or replace function public.duplicate_quote(p_quote uuid, p_new_version boolean default false) returns uuid
language plpgsql security invoker set search_path = public as $$
declare src public.quotes; new_id uuid; v int; root uuid;
begin
  if not public.has_role('funcionario') then raise exception 'Sem permissão.'; end if;
  select * into src from public.quotes where id = p_quote;
  if not found then raise exception 'Orçamento não encontrado.'; end if;
  root := coalesce(src.root_id, src.id);
  v := case when p_new_version then (select coalesce(max(version), 1) + 1 from public.quotes where id = root or root_id = root) else 1 end;
  insert into public.quotes (version, root_id, client_id, status, child_name, child_age, theme, event_date, start_time, duration_hours,
    guests, discount_type, discount_value, fees_value, fees_description, down_payment, installments, payment_methods, payment_notes,
    notes, internal_notes, valid_until)
  values (v, case when p_new_version then root else null end, src.client_id, 'em_elaboracao', src.child_name, src.child_age, src.theme,
    src.event_date, src.start_time, src.duration_hours, src.guests, src.discount_type, src.discount_value, src.fees_value,
    src.fees_description, src.down_payment, src.installments, src.payment_methods, src.payment_notes, src.notes, src.internal_notes,
    current_date + (select quote_validity_days from public.settings where id = 1))
  returning id into new_id;
  insert into public.quote_items (quote_id, catalog_item_id, category, description, details, quantity, unit_price, position)
    select new_id, catalog_item_id, category, description, details, quantity, unit_price, position from public.quote_items where quote_id = p_quote;
  insert into public.quote_installments (quote_id, n, due_date, amount)
    select new_id, n, due_date, amount from public.quote_installments where quote_id = p_quote;
  insert into public.quote_history (quote_id, action, details)
    values (new_id, case when p_new_version then 'Nova versão' else 'Duplicado' end, 'A partir do orçamento nº ' || src.number || ' v' || src.version);
  if p_new_version then
    insert into public.quote_history (quote_id, action, details) values (p_quote, 'Nova versão criada', 'Versão ' || v);
  end if;
  return new_id;
end $$;

-- Expira propostas vencidas (chamada pelo painel ao abrir)
create or replace function public.expire_quotes() returns int
language sql security invoker set search_path = public as $$
  with upd as (
    update public.quotes set status = 'expirado'
    where status in ('enviado', 'aguardando_resposta', 'em_negociacao') and valid_until < current_date
    returning 1)
  select count(*)::int from upd
$$;

-- =============================================================================
-- FESTAS (EVENTOS) E CHECKLIST
-- =============================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid unique references public.quotes (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete restrict,
  child_name text default '',
  child_age text default '',
  event_date date not null,
  start_time time not null default '14:00',
  end_time time not null default '18:00',
  guests int,
  package_name text default '',
  theme text default '',
  menu text default '',
  decoration text default '',
  services text default '',
  special_info text default '',
  restrictions text default '',
  status public.event_status not null default 'aguardando_confirmacao',
  contract_value numeric(12,2) not null default 0 check (contract_value >= 0),
  rating int check (rating is null or rating between 1 and 5),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  period tsrange generated always as (tsrange(event_date + start_time, event_date + end_time, '[)')) stored,
  constraint events_time_ok check (end_time > start_time),
  constraint events_no_overlap exclude using gist (period with &&) where (status <> 'cancelada')
);
create index if not exists events_date_idx on public.events (event_date);
alter table public.events enable row level security;
drop trigger if exists events_updated on public.events;
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated using (public.has_role('funcionario'));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated with check (public.has_role('gerente'));
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated using (public.has_role('gerente')) with check (public.has_role('gerente'));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated using (public.has_role('admin'));

create table if not exists public.event_checklist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position int not null,
  step text not null,
  done boolean not null default false,
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz
);
create index if not exists checklist_event_idx on public.event_checklist (event_id, position);
alter table public.event_checklist enable row level security;
drop policy if exists checklist_select on public.event_checklist;
create policy checklist_select on public.event_checklist for select to authenticated using (public.has_role('funcionario'));
drop policy if exists checklist_update on public.event_checklist;
create policy checklist_update on public.event_checklist for update to authenticated using (public.has_role('funcionario')) with check (public.has_role('funcionario'));
drop policy if exists checklist_insert on public.event_checklist;
create policy checklist_insert on public.event_checklist for insert to authenticated with check (public.has_role('gerente'));
drop policy if exists checklist_delete on public.event_checklist;
create policy checklist_delete on public.event_checklist for delete to authenticated using (public.has_role('gerente'));

create or replace function public.checklist_stamp() returns trigger
language plpgsql as $$
begin
  if new.done and not old.done then new.done_by = auth.uid(); new.done_at = now();
  elsif not new.done then new.done_by = null; new.done_at = null; end if;
  return new;
end $$;
drop trigger if exists checklist_stamp on public.event_checklist;
create trigger checklist_stamp before update on public.event_checklist for each row execute function public.checklist_stamp();

-- =============================================================================
-- FINANCEIRO
-- =============================================================================
-- Cada linha é um valor a receber (entrada/parcela/extra), um desconto concedido
-- ou um reembolso. "Recebido" = linha com paid_at preenchido.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  kind public.payment_kind not null,
  description text default '',
  amount numeric(12,2) not null check (amount > 0),
  due_date date,
  paid_at date,
  method text default '',
  notes text default '',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payments_event_idx on public.payments (event_id);
create index if not exists payments_due_idx on public.payments (due_date);
alter table public.payments enable row level security;
drop policy if exists payments_rw on public.payments;
create policy payments_rw on public.payments for select to authenticated using (public.has_role('gerente'));
drop policy if exists payments_ins on public.payments;
create policy payments_ins on public.payments for insert to authenticated with check (public.has_role('gerente'));
drop policy if exists payments_upd on public.payments;
create policy payments_upd on public.payments for update to authenticated using (public.has_role('gerente')) with check (public.has_role('gerente'));
drop policy if exists payments_del on public.payments;
create policy payments_del on public.payments for delete to authenticated using (public.has_role('admin'));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  category text not null default 'Outros',
  description text not null check (char_length(trim(description)) between 1 and 300),
  amount numeric(12,2) not null check (amount > 0),
  date date not null default current_date,
  paid boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (date);
alter table public.expenses enable row level security;
drop policy if exists expenses_rw on public.expenses;
create policy expenses_rw on public.expenses for select to authenticated using (public.has_role('gerente'));
drop policy if exists expenses_ins on public.expenses;
create policy expenses_ins on public.expenses for insert to authenticated with check (public.has_role('gerente'));
drop policy if exists expenses_upd on public.expenses;
create policy expenses_upd on public.expenses for update to authenticated using (public.has_role('gerente')) with check (public.has_role('gerente'));
drop policy if exists expenses_del on public.expenses;
create policy expenses_del on public.expenses for delete to authenticated using (public.has_role('admin'));

-- =============================================================================
-- ORÇAMENTO APROVADO → FESTA CONFIRMADA (tudo numa transação)
-- =============================================================================
create or replace function public.convert_quote_to_event(p_quote uuid, p_start time default null, p_end time default null) returns uuid
language plpgsql security invoker set search_path = public as $$
declare q public.quotes; c public.clients; ev uuid; st time; en time; s public.settings; agg_menu text; agg_deco text; agg_serv text; pkg text;
begin
  if not public.has_role('gerente') then raise exception 'Apenas gerentes e administradores podem confirmar festas.'; end if;
  select * into q from public.quotes where id = p_quote for update;
  if not found then raise exception 'Orçamento não encontrado.'; end if;
  if exists (select 1 from public.events where quote_id = p_quote) then raise exception 'Este orçamento já virou uma festa.'; end if;
  if q.event_date is null then raise exception 'Defina a data da festa no orçamento antes de confirmar.'; end if;
  if q.status in ('recusado', 'expirado') then raise exception 'Orçamentos recusados ou expirados não podem virar festa. Crie uma nova versão.'; end if;

  select * into s from public.settings where id = 1;
  st := coalesce(p_start, q.start_time, s.default_start_time);
  en := coalesce(p_end, (st + make_interval(mins => (coalesce(q.duration_hours, s.default_duration_hours) * 60)::int))::time);
  if en <= st then raise exception 'O horário de término precisa ser depois do início.'; end if;

  select string_agg(description, ', ' order by position) filter (where category = 'pacote'),
         string_agg(description, ', ' order by position) filter (where category in ('cardapio', 'bebida')),
         string_agg(description, ', ' order by position) filter (where category in ('decoracao', 'tema')),
         string_agg(description, ', ' order by position) filter (where category in ('recreacao', 'atracao', 'servico', 'personalizado'))
    into pkg, agg_menu, agg_deco, agg_serv
  from public.quote_items where quote_id = p_quote;

  update public.quotes set status = 'aprovado' where id = p_quote;

  begin
    insert into public.events (quote_id, client_id, child_name, child_age, event_date, start_time, end_time, guests,
      package_name, theme, menu, decoration, services, special_info, status, contract_value)
    values (p_quote, q.client_id, q.child_name, q.child_age, q.event_date, st, en, q.guests,
      coalesce(pkg, ''), coalesce(q.theme, ''), coalesce(agg_menu, ''), coalesce(agg_deco, ''), coalesce(agg_serv, ''), coalesce(q.notes, ''),
      'confirmada', q.total)
    returning id into ev;
  exception when exclusion_violation then
    raise exception 'Já existe uma festa nesse dia e horário. Escolha outro horário.';
  end;

  insert into public.event_checklist (event_id, position, step)
  select ev, ord, step from unnest(array[
    'Confirmação do evento', 'Confirmação do número de convidados', 'Definição do cardápio', 'Definição da decoração',
    'Organização da equipe', 'Preparação do espaço', 'Conferência dos itens', 'Realização do evento', 'Finalização e avaliação'
  ]) with ordinality as t(step, ord);
  update public.event_checklist set done = true where event_id = ev and position = 1;

  -- Valores a receber a partir das condições do orçamento
  if exists (select 1 from public.quote_installments where quote_id = p_quote) then
    insert into public.payments (event_id, client_id, kind, description, amount, due_date)
    select ev, q.client_id, case when n = 0 then 'entrada'::public.payment_kind else 'parcela'::public.payment_kind end,
           case when n = 0 then 'Entrada' else 'Parcela ' || n end, amount, due_date
    from public.quote_installments where quote_id = p_quote and amount > 0 order by n;
  elsif q.total > 0 then
    insert into public.payments (event_id, client_id, kind, description, amount, due_date)
    values (ev, q.client_id, 'parcela', 'Valor da festa', q.total, q.event_date);
  end if;

  insert into public.quote_history (quote_id, action, details) values (p_quote, 'Festa confirmada', 'Festa criada na agenda');
  insert into public.client_interactions (client_id, kind, note)
    values (q.client_id, 'sistema', 'Festa confirmada para ' || to_char(q.event_date, 'DD/MM/YYYY') || ' (orçamento nº ' || q.number || ').');
  return ev;
end $$;

-- =============================================================================
-- PROPOSTA PÚBLICA (link que o cliente abre pelo WhatsApp)
-- Só devolve o orçamento do token informado; nada mais é exposto.
-- =============================================================================
create or replace function public.get_public_quote(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q public.quotes; result jsonb;
begin
  select * into q from public.quotes where share_token = p_token;
  if not found or q.status = 'em_elaboracao' then return null; end if;
  select jsonb_build_object(
    'quote', jsonb_build_object('number', q.number, 'version', q.version, 'status', q.status, 'child_name', q.child_name,
      'child_age', q.child_age, 'theme', q.theme, 'event_date', q.event_date, 'start_time', q.start_time, 'duration_hours', q.duration_hours,
      'guests', q.guests, 'subtotal', q.subtotal, 'discount_amount', q.discount_amount, 'fees_value', q.fees_value,
      'fees_description', q.fees_description, 'total', q.total, 'down_payment', q.down_payment, 'installments', q.installments,
      'payment_methods', q.payment_methods, 'payment_notes', q.payment_notes, 'notes', q.notes, 'valid_until', q.valid_until,
      'created_at', q.created_at, 'accepted_name', q.accepted_name, 'approved_at', q.approved_at),
    'client', (select jsonb_build_object('responsible_name', responsible_name) from public.clients where id = q.client_id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'description', description, 'details', details,
      'quantity', quantity, 'unit_price', unit_price, 'total', total) order by position) from public.quote_items where quote_id = q.id), '[]'::jsonb),
    'installments', coalesce((select jsonb_agg(jsonb_build_object('n', n, 'due_date', due_date, 'amount', amount) order by n)
      from public.quote_installments where quote_id = q.id), '[]'::jsonb),
    'settings', (select jsonb_build_object('buffet_name', buffet_name, 'logo_url', logo_url, 'address', address, 'phone', phone,
      'whatsapp', whatsapp, 'email', email, 'instagram', instagram, 'document', document, 'legal_name', legal_name,
      'quote_intro', quote_intro, 'quote_terms', quote_terms, 'quote_footer', quote_footer) from public.settings where id = 1)
  ) into result;
  return result;
end $$;

create or replace function public.accept_public_quote(p_token uuid, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare q public.quotes;
begin
  if char_length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Informe seu nome completo para aceitar.'; end if;
  select * into q from public.quotes where share_token = p_token for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if q.status = 'aprovado' then return 'aprovado'; end if;
  if q.status not in ('enviado', 'aguardando_resposta', 'em_negociacao') then raise exception 'Esta proposta não está disponível para aceite.'; end if;
  if q.valid_until is not null and q.valid_until < current_date then
    update public.quotes set status = 'expirado' where id = q.id;
    return 'expirado';
  end if;
  update public.quotes set status = 'aprovado', accepted_name = left(trim(p_name), 160) where id = q.id;
  insert into public.quote_history (quote_id, action, details, user_id) values (q.id, 'Aceite do cliente', 'Aceito online por ' || left(trim(p_name), 160), null);
  return 'aprovado';
end $$;

revoke all on function public.get_public_quote(uuid) from public;
revoke all on function public.accept_public_quote(uuid, text) from public;
grant execute on function public.get_public_quote(uuid) to anon, authenticated;
grant execute on function public.accept_public_quote(uuid, text) to anon, authenticated;
revoke all on function public.convert_quote_to_event(uuid, time, time) from public, anon;
grant execute on function public.convert_quote_to_event(uuid, time, time) to authenticated;
revoke all on function public.duplicate_quote(uuid, boolean) from public, anon;
grant execute on function public.duplicate_quote(uuid, boolean) to authenticated;
revoke all on function public.expire_quotes() from public, anon;
grant execute on function public.expire_quotes() to authenticated;

-- =============================================================================
-- AUDITORIA: registra alterações importantes (quem, quando, o quê)
-- =============================================================================
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null,
  changes jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists audit_idx on public.audit_log (table_name, record_id, created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated using (public.has_role('gerente'));

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare diff jsonb; rid text;
begin
  rid := case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value) into diff
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('updated_at', 'period') and (to_jsonb(old) -> n.key) is distinct from n.value;
    if diff is null then return null; end if;
  elsif tg_op = 'INSERT' then diff := to_jsonb(new);
  else diff := to_jsonb(old);
  end if;
  insert into public.audit_log (table_name, record_id, action, changes, user_id)
  values (tg_table_name, coalesce(rid, ''), lower(tg_op), diff, auth.uid());
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['clients', 'quotes', 'events', 'payments', 'expenses', 'catalog_items', 'settings', 'profiles'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- =============================================================================
-- ARQUIVOS (logo e imagens do catálogo) — bucket público de leitura
-- =============================================================================
insert into storage.buckets (id, name, public) values ('arquivos', 'arquivos', true) on conflict (id) do nothing;
drop policy if exists arquivos_insert on storage.objects;
create policy arquivos_insert on storage.objects for insert to authenticated with check (bucket_id = 'arquivos' and public.has_role('gerente'));
drop policy if exists arquivos_update on storage.objects;
create policy arquivos_update on storage.objects for update to authenticated using (bucket_id = 'arquivos' and public.has_role('gerente'));
drop policy if exists arquivos_delete on storage.objects;
create policy arquivos_delete on storage.objects for delete to authenticated using (bucket_id = 'arquivos' and public.has_role('gerente'));

-- Pronto. Volte ao painel (/gestor/) e crie a sua conta: a primeira vira administradora.

-- Atualiza o cache da API para enxergar as tabelas novas na hora
notify pgrst, 'reload schema';
