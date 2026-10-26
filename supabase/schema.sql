-- Siguraduhing active ang UUID extension
create extension if not exists "uuid-ossp";

-- 1. ENUMS PARA SA ROLES AT STATUS
do $$ begin
  create type user_role as enum ('intern', 'supervisor', 'coordinator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- 2. MASTER PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role user_role not null,
  contact_number text,
  home_address text,
  emergency_contact_name text,
  emergency_contact_number text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. COMPANY SITES
create table if not exists public.company_sites (
  id uuid default uuid_generate_v4() primary key,
  supervisor_id uuid references public.profiles(id) on delete cascade unique,
  company_name text not null,
  office_address text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer default 150,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. INTERN-SUPERVISOR LINK REQUESTS
create table if not exists public.intern_supervisor_links (
  id uuid default uuid_generate_v4() primary key,
  intern_id uuid references public.profiles(id) on delete cascade unique,
  supervisor_id uuid references public.profiles(id) on delete cascade,
  status request_status default 'pending',
  rejection_reason text,
  linked_at timestamptz,
  created_at timestamptz default now()
);

-- 5. AUTOMATIC PROFILE CREATION TRIGGER
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, contact_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'TraiNext User'),
    (coalesce(new.raw_user_meta_data->>'role', 'intern'))::user_role,
    coalesce(new.raw_user_meta_data->>'contact_number', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.company_sites enable row level security;
alter table public.intern_supervisor_links enable row level security;

-- 7. CLEAN & RE-APPLY POLICIES (May DROP muna para iwas ERROR 42710)

-- Profiles Policies
drop policy if exists "Allow read all profiles for authenticated users" on public.profiles;
create policy "Allow read all profiles for authenticated users" 
  on public.profiles for select using (auth.role() = 'authenticated');

drop policy if exists "Allow user to update own profile" on public.profiles;
create policy "Allow user to update own profile" 
  on public.profiles for update using (auth.uid() = id);

-- Company Sites Policies
drop policy if exists "Allow read company sites" on public.company_sites;
create policy "Allow read company sites" 
  on public.company_sites for select using (auth.role() = 'authenticated');

drop policy if exists "Supervisor manage own company site" on public.company_sites;
create policy "Supervisor manage own company site" 
  on public.company_sites for all using (auth.uid() = supervisor_id);

-- Links Policies
drop policy if exists "Read links for authenticated users" on public.intern_supervisor_links;
create policy "Read links for authenticated users" 
  on public.intern_supervisor_links for select using (auth.role() = 'authenticated');

drop policy if exists "Intern can send link request" on public.intern_supervisor_links;
create policy "Intern can send link request" 
  on public.intern_supervisor_links for insert with check (auth.uid() = intern_id);

drop policy if exists "Supervisor can update link status" on public.intern_supervisor_links;
create policy "Supervisor can update link status" 
  on public.intern_supervisor_links for update using (auth.uid() = supervisor_id);

  -- 1. ATTENDANCE STATUS ENUM
do $$ begin
  create type attendance_status as enum ('on_duty', 'in_transit', 'safe_at_base');
exception when duplicate_object then null; end $$;

-- 2. CREATE TABLE KUNG WALA PA
create table if not exists public.attendance_logs (
  id uuid default uuid_generate_v4() primary key,
  intern_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- 3. AUTOMATIC ALTER PARA SA MGA KULANG NA COLUMNS (IWAS COLUMN DOES NOT EXIST)
alter table public.attendance_logs 
  add column if not exists supervisor_id uuid references public.profiles(id) on delete set null,
  add column if not exists date date default current_date not null,
  add column if not exists time_in timestamptz default now() not null,
  add column if not exists time_in_lat double precision,
  add column if not exists time_in_lng double precision,
  add column if not exists time_out timestamptz,
  add column if not exists hours_rendered numeric(5,2) default 0,
  add column if not exists status attendance_status default 'on_duty' not null,
  add column if not exists safe_at_base_time timestamptz,
  add column if not exists transit_waiver_agreed boolean default false;

-- 4. RE-APPLY INDEXES
create index if not exists idx_attendance_intern_date on public.attendance_logs(intern_id, date);
create index if not exists idx_attendance_supervisor on public.attendance_logs(supervisor_id);

-- 5. ROW LEVEL SECURITY (RLS)
alter table public.attendance_logs enable row level security;

-- Ligtas na i-drop at i-recreate ang policies
drop policy if exists "Authenticated users can read attendance" on public.attendance_logs;
create policy "Authenticated users can read attendance" 
  on public.attendance_logs for select using (auth.role() = 'authenticated');

drop policy if exists "Interns can insert attendance" on public.attendance_logs;
create policy "Interns can insert attendance" 
  on public.attendance_logs for insert with check (auth.uid() = intern_id);

drop policy if exists "Interns can update own attendance" on public.attendance_logs;
create policy "Interns can update own attendance" 
  on public.attendance_logs for update using (auth.uid() = intern_id);


  -- 1. BASE ACCOMPLISHMENT TABLE KUNG WALA PA
create table if not exists public.accomplishment_logs (
  id uuid default uuid_generate_v4() primary key,
  intern_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- 2. ADD COLUMNS (IWAS COLUMN ERROR KUNG MAY LUMANG TABLE NA)
alter table public.accomplishment_logs
  add column if not exists supervisor_id uuid references public.profiles(id) on delete set null,
  add column if not exists title text default '' not null,
  add column if not exists description text default '' not null,
  add column if not exists report_date date default current_date not null,
  add column if not exists rendered_hours numeric(4,2) default 0 not null,
  add column if not exists proof_images text[] default '{}',
  add column if not exists proof_documents text[] default '{}',
  add column if not exists video_url text,
  add column if not exists status request_status default 'pending' not null,
  add column if not exists feedback text,
  add column if not exists approved_at timestamptz;

-- 3. RE-APPLY INDEXES
create index if not exists idx_accomplishments_intern on public.accomplishment_logs(intern_id);
create index if not exists idx_accomplishments_supervisor on public.accomplishment_logs(supervisor_id);
create index if not exists idx_accomplishments_status on public.accomplishment_logs(status);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.accomplishment_logs enable row level security;

drop policy if exists "Authenticated users can read accomplishments" on public.accomplishment_logs;
create policy "Authenticated users can read accomplishments" 
  on public.accomplishment_logs for select using (auth.role() = 'authenticated');

drop policy if exists "Interns can insert own accomplishments" on public.accomplishment_logs;
create policy "Interns can insert own accomplishments" 
  on public.accomplishment_logs for insert with check (auth.uid() = intern_id);

drop policy if exists "Interns can update own pending accomplishments" on public.accomplishment_logs;
create policy "Interns can update own pending accomplishments" 
  on public.accomplishment_logs for update using (auth.uid() = intern_id and status = 'pending');

drop policy if exists "Interns can delete own pending accomplishments" on public.accomplishment_logs;
create policy "Interns can delete own pending accomplishments" 
  on public.accomplishment_logs for delete using (auth.uid() = intern_id and status = 'pending');

drop policy if exists "Supervisors can update assigned accomplishments" on public.accomplishment_logs;
create policy "Supervisors can update assigned accomplishments" 
  on public.accomplishment_logs for update using (auth.uid() = supervisor_id);