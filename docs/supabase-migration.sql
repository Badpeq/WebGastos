-- NóminaHogar Perú — Supabase Schema
-- Ejecutar en: https://supabase.com → tu proyecto → SQL Editor → New Query
-- (Idempotente: puedes ejecutarlo varias veces sin error)

-- ── Perfiles de empleador ──────────────────────────
create table if not exists nomina_empleadores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade not null,
  nombre     text not null default 'Mi hogar',
  data       jsonb not null default '{}',
  firmas     jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table nomina_empleadores enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'nomina_empleadores' and policyname = 'own'
  ) then
    create policy "own" on nomina_empleadores
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── Trabajadores ───────────────────────────────────
create table if not exists nomina_trabajadores (
  id           text primary key,
  empleador_id uuid references nomina_empleadores on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  data         jsonb not null default '{}',
  created_at   timestamptz default now()
);

alter table nomina_trabajadores enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'nomina_trabajadores' and policyname = 'own'
  ) then
    create policy "own" on nomina_trabajadores
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── Boletas de pago ────────────────────────────────
create table if not exists nomina_boletas (
  id           text primary key,
  empleador_id uuid references nomina_empleadores on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  data         jsonb not null default '{}',
  foto_firmada text,
  created_at   timestamptz default now()
);

alter table nomina_boletas enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'nomina_boletas' and policyname = 'own'
  ) then
    create policy "own" on nomina_boletas
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
