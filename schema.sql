-- Current OS Postgres Database Schema for Supabase

-- Reference table for site components & hold points
create table if not exists public.components (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  hold_point boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Active site projects
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Incoming raw WhatsApp messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade,
  wa_message_id text unique not null,
  sender_phone text not null,
  media_type text not null,
  media_id text,
  caption text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Processing queue jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  status text check (status in ('queued', 'running', 'done', 'failed', 'dead')) default 'queued',
  attempts integer default 0,
  last_error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Processed evidence records from Gemini QA analysis
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  component_key text references public.components(key),
  storage_path text not null,
  media_type text not null,
  qa_status text check (qa_status in ('pass', 'fail', 'uncertain')) not null,
  notes text,
  confidence numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on all tables
alter table public.components enable row level security;
alter table public.sites enable row level security;
alter table public.messages enable row level security;
alter table public.jobs enable row level security;
alter table public.evidence enable row level security;

-- Seed default components
insert into public.components (key, label, hold_point) values
  ('earthworks', 'Site Excavation & Subgrade Prep', false),
  ('concrete_slab', 'Post-Tension Slab Pour & Cure', true),
  ('steel_structure', 'Superstructure & Post Installation', true),
  ('glass_surround', 'Glass Wall Panel Installation', true),
  ('turf_installation', 'Turf Laying & Infill Distribution', false),
  ('lighting_electrical', 'Electrical Wiring & Luminaire Mounting', false)
on conflict (key) do nothing;

-- UNCOMMENT & SEED TEST SITE (Replace digits with your test phone number, digits only):
-- insert into public.sites (name, phone_number) values
--   ('Key Largo Court 1', '13055550199')
-- on conflict (phone_number) do nothing;