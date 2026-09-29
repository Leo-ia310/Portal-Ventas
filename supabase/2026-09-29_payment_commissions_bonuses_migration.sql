alter table public.leads
  add column if not exists meeting_at timestamptz,
  add column if not exists payment_status text not null default 'pendiente',
  add column if not exists agreed_amount numeric(12,2),
  add column if not exists final_sale_amount numeric(12,2),
  add column if not exists price_adjustment_note text,
  add column if not exists payment_approved_at timestamptz,
  add column if not exists payment_approved_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_payment_status_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_payment_status_check
      check (payment_status in ('pendiente', 'pagado', 'parcial', 'reembolsado'));
  end if;
end;
$$;

alter table public.commissions
  add column if not exists agreed_amount numeric(12,2),
  add column if not exists approved_at timestamptz,
  add column if not exists paid_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_leads_payment_status on public.leads(payment_status);
create unique index if not exists idx_commissions_unique_lead on public.commissions(lead_id) where lead_id is not null;

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
