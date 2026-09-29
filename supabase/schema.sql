create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'agente')) default 'agente',
  created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  country text,
  phone text,
  whatsapp text,
  availability text,
  status text not null check (status in ('prueba', 'activo', 'pausado', 'capacitación', 'desactivado')) default 'capacitación',
  compensation_mode text not null check (compensation_mode in ('comisión', 'base + comisión', 'acuerdo especial')) default 'comisión',
  commission_rate numeric(5,4) not null default 0.30,
  base_salary numeric(12,2),
  start_date date,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  country text,
  city text,
  source_channel text,
  whatsapp text,
  email text,
  social_url text,
  requested_service text,
  main_problem text,
  estimated_budget text,
  recommended_plan text,
  status text not null check (
    status in (
      'Nuevo',
      'Contactado',
      'Interesado',
      'Calificado',
      'Llamada agendada',
      'Propuesta enviada',
      'Negociación',
      'Ganado',
      'Perdido',
      'Seguimiento futuro'
    )
  ) default 'Nuevo',
  next_action text,
  next_follow_up_at timestamptz,
  last_contact_at timestamptz,
  meeting_at timestamptz,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  payment_status text not null check (payment_status in ('pendiente', 'pagado', 'parcial', 'reembolsado')) default 'pendiente',
  agreed_amount numeric(12,2),
  final_sale_amount numeric(12,2),
  price_adjustment_note text,
  payment_confirmed boolean not null default false,
  payment_approved_at timestamptz,
  payment_approved_by uuid references public.profiles(id) on delete set null,
  won_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_won_requires_payment check (status <> 'Ganado' or payment_confirmed = true)
);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  type text not null,
  notes text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_reports (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  report_date date not null default current_date,
  new_contacts integer not null default 0,
  responses_received integer not null default 0,
  followups_sent integer not null default 0,
  calls_scheduled integer not null default 0,
  proposals_sent integer not null default 0,
  sales_closed integer not null default 0,
  blockers text,
  needs_from_admin text,
  created_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  agent_id uuid not null references public.agents(id) on delete cascade,
  sale_amount numeric(12,2) not null check (sale_amount >= 0),
  agreed_amount numeric(12,2),
  commission_rate numeric(5,4) not null check (commission_rate >= 0 and commission_rate <= 1),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  status text not null check (status in ('estimada', 'aprobada', 'pagada', 'anulada')) default 'estimada',
  closed_at date,
  approved_at timestamptz,
  paid_at date,
  paid_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  content text,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.training_progress (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (agent_id, module_id)
);

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  content text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  url text not null,
  description text,
  version text default '1.0',
  visible_to_agents boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_approvals (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  lead_id uuid references public.leads(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null check (status in ('pendiente', 'aprobada', 'rechazada')) default 'pendiente',
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_agents_user_id on public.agents(user_id);
create index if not exists idx_leads_assigned_agent on public.leads(assigned_agent_id);
create index if not exists idx_leads_created_by on public.leads(created_by);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_next_follow_up on public.leads(next_follow_up_at);
create index if not exists idx_leads_source_channel on public.leads(source_channel);
create index if not exists idx_leads_payment_status on public.leads(payment_status);
create index if not exists idx_lead_activities_lead on public.lead_activities(lead_id);
create index if not exists idx_sales_reports_agent_date on public.sales_reports(agent_id, report_date desc);
create index if not exists idx_commissions_agent on public.commissions(agent_id);
create unique index if not exists idx_commissions_unique_lead on public.commissions(lead_id) where lead_id is not null;
create index if not exists idx_training_progress_agent on public.training_progress(agent_id);
create index if not exists idx_scripts_active on public.scripts(active);
create index if not exists idx_documents_visible on public.documents(visible_to_agents);

drop trigger if exists set_agents_updated_at on public.agents;
create trigger set_agents_updated_at before update on public.agents
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_scripts_updated_at on public.scripts;
create trigger set_scripts_updated_at before update on public.scripts
for each row execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at before update on public.settings
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.agents where user_id = auth.uid()
$$;

create or replace function public.can_access_lead(lead_assigned_agent_id uuid, lead_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or lead_created_by = auth.uid()
    or lead_assigned_agent_id = public.current_agent_id()
$$;

create or replace function public.protect_lead_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
    or new.agreed_amount is distinct from old.agreed_amount
    or new.final_sale_amount is distinct from old.final_sale_amount
    or new.price_adjustment_note is distinct from old.price_adjustment_note
    or new.payment_confirmed is distinct from old.payment_confirmed
    or new.payment_approved_at is distinct from old.payment_approved_at
    or new.payment_approved_by is distinct from old.payment_approved_by
    or new.won_at is distinct from old.won_at then
    raise exception 'Solo admin puede modificar pagos, montos y comisiones del lead.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_lead_payment_fields on public.leads;
create trigger protect_lead_payment_fields before update on public.leads
for each row execute function public.protect_lead_payment_fields();

alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.sales_reports enable row level security;
alter table public.commissions enable row level security;
alter table public.training_modules enable row level security;
alter table public.training_progress enable row level security;
alter table public.scripts enable row level security;
alter table public.documents enable row level security;
alter table public.admin_approvals enable row level security;
alter table public.settings enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
for insert with check (public.is_admin() or (id = auth.uid() and role = 'agente'));

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "agents read own or admin" on public.agents;
create policy "agents read own or admin" on public.agents
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "agents admin insert" on public.agents;
create policy "agents admin insert" on public.agents
for insert with check (public.is_admin());

drop policy if exists "agents admin update" on public.agents;
create policy "agents admin update" on public.agents
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "agents admin delete" on public.agents;
create policy "agents admin delete" on public.agents
for delete using (public.is_admin());

drop policy if exists "leads read assigned created or admin" on public.leads;
create policy "leads read assigned created or admin" on public.leads
for select using (public.can_access_lead(assigned_agent_id, created_by));

drop policy if exists "leads insert own or admin" on public.leads;
create policy "leads insert own or admin" on public.leads
for insert with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and coalesce(assigned_agent_id, public.current_agent_id()) = public.current_agent_id()
  )
);

drop policy if exists "leads update assigned created or admin" on public.leads;
create policy "leads update assigned created or admin" on public.leads
for update using (public.can_access_lead(assigned_agent_id, created_by))
with check (
  public.is_admin()
  or (
    public.can_access_lead(assigned_agent_id, created_by)
    and coalesce(assigned_agent_id, public.current_agent_id()) = public.current_agent_id()
  )
);

drop policy if exists "leads admin delete" on public.leads;
create policy "leads admin delete" on public.leads
for delete using (public.is_admin());

drop policy if exists "activities read by lead access" on public.lead_activities;
create policy "activities read by lead access" on public.lead_activities
for select using (
  public.is_admin()
  or exists (
    select 1 from public.leads l
    where l.id = lead_id
      and public.can_access_lead(l.assigned_agent_id, l.created_by)
  )
);

drop policy if exists "activities insert on own leads" on public.lead_activities;
create policy "activities insert on own leads" on public.lead_activities
for insert with check (
  public.is_admin()
  or (
    agent_id = public.current_agent_id()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id
        and public.can_access_lead(l.assigned_agent_id, l.created_by)
    )
  )
);

drop policy if exists "reports read own or admin" on public.sales_reports;
create policy "reports read own or admin" on public.sales_reports
for select using (public.is_admin() or agent_id = public.current_agent_id());

drop policy if exists "reports insert own" on public.sales_reports;
create policy "reports insert own" on public.sales_reports
for insert with check (agent_id = public.current_agent_id());

drop policy if exists "reports update own or admin" on public.sales_reports;
create policy "reports update own or admin" on public.sales_reports
for update using (public.is_admin() or agent_id = public.current_agent_id())
with check (public.is_admin() or agent_id = public.current_agent_id());

drop policy if exists "commissions read own or admin" on public.commissions;
create policy "commissions read own or admin" on public.commissions
for select using (public.is_admin() or agent_id = public.current_agent_id());

drop policy if exists "commissions admin write" on public.commissions;
create policy "commissions admin write" on public.commissions
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "training read active or admin" on public.training_modules;
create policy "training read active or admin" on public.training_modules
for select using (active = true or public.is_admin());

drop policy if exists "training admin write" on public.training_modules;
create policy "training admin write" on public.training_modules
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "progress read own or admin" on public.training_progress;
create policy "progress read own or admin" on public.training_progress
for select using (public.is_admin() or agent_id = public.current_agent_id());

drop policy if exists "progress write own or admin" on public.training_progress;
create policy "progress write own or admin" on public.training_progress
for all using (public.is_admin() or agent_id = public.current_agent_id())
with check (public.is_admin() or agent_id = public.current_agent_id());

drop policy if exists "scripts read active or admin" on public.scripts;
create policy "scripts read active or admin" on public.scripts
for select using (active = true or public.is_admin());

drop policy if exists "scripts admin write" on public.scripts;
create policy "scripts admin write" on public.scripts
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "documents read visible or admin" on public.documents;
create policy "documents read visible or admin" on public.documents
for select using (visible_to_agents = true or public.is_admin());

drop policy if exists "documents admin write" on public.documents;
create policy "documents admin write" on public.documents
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "approvals read own or admin" on public.admin_approvals;
create policy "approvals read own or admin" on public.admin_approvals
for select using (public.is_admin() or requested_by = auth.uid());

drop policy if exists "approvals create request" on public.admin_approvals;
create policy "approvals create request" on public.admin_approvals
for insert with check (public.is_admin() or requested_by = auth.uid());

drop policy if exists "approvals admin update" on public.admin_approvals;
create policy "approvals admin update" on public.admin_approvals
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings read authenticated" on public.settings;
create policy "settings read authenticated" on public.settings
for select using (auth.role() = 'authenticated');

drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings
for all using (public.is_admin()) with check (public.is_admin());
