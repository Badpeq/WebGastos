-- NóminaHogar Perú — Supabase Schema v2
-- Ejecutar en: SQL Editor → New query → Run
-- Si ya ejecutaste antes, este script borra y recrea las políticas sin error.

-- ── 1. Tablas ──────────────────────────────────────

create table if not exists nomina_empleadores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade not null,
  nombre     text not null default 'Mi hogar',
  data       jsonb not null default '{}',
  firmas     jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists nomina_trabajadores (
  id           text primary key,
  empleador_id uuid references nomina_empleadores on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  data         jsonb not null default '{}',
  created_at   timestamptz default now()
);

create table if not exists nomina_boletas (
  id           text primary key,
  empleador_id uuid references nomina_empleadores on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  data         jsonb not null default '{}',
  foto_firmada text,
  created_at   timestamptz default now()
);

-- ── 2. Permisos (anon + authenticated pueden operar) ─

grant select, insert, update, delete on nomina_empleadores  to anon, authenticated;
grant select, insert, update, delete on nomina_trabajadores to anon, authenticated;
grant select, insert, update, delete on nomina_boletas      to anon, authenticated;

-- ── 3. Row Level Security ──────────────────────────

alter table nomina_empleadores  enable row level security;
alter table nomina_trabajadores enable row level security;
alter table nomina_boletas      enable row level security;

-- Eliminar políticas previas si existen (evita error "already exists")
drop policy if exists "own" on nomina_empleadores;
drop policy if exists "own" on nomina_trabajadores;
drop policy if exists "own" on nomina_boletas;

-- Cada usuario solo ve/modifica sus propios datos
create policy "own" on nomina_empleadores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own" on nomina_trabajadores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own" on nomina_boletas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
