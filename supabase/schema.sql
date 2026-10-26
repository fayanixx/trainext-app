create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('intern', 'supervisor', 'coordinator');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.approval_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'intern' check (role in ('intern', 'supervisor', 'coordinator')),
  supervisor_id uuid references public.profiles (id) on delete set null,
  coordinator_id uuid references public.profiles (id) on delete set null,
  required_hours numeric(7, 2) not null default 486 check (required_hours > 0),
  enrollment_status public.approval_status not null default 'pending',
  deployment_status public.approval_status not null default 'pending',
  enrollment_feedback text,
  deployment_feedback text,
  phone text,
  id_number text,
  university_name text,
  company_name text,
  company_address text,
  home_base_address text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and udt_name = 'app_role'
  ) then
    drop view if exists public.intern_progress;
    alter table public.profiles alter column role drop default;
    alter table public.profiles alter column role type text using role::text;
    alter table public.profiles alter column role set default 'intern';
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('intern', 'supervisor', 'coordinator'));

alter table public.profiles add column if not exists coordinator_id uuid references public.profiles (id) on delete set null;
alter table public.profiles add column if not exists enrollment_status public.approval_status not null default 'pending';
alter table public.profiles add column if not exists deployment_status public.approval_status not null default 'pending';
alter table public.profiles add column if not exists enrollment_feedback text;
alter table public.profiles add column if not exists deployment_feedback text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists id_number text;
alter table public.profiles add column if not exists university_name text;
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists company_address text;
alter table public.profiles add column if not exists home_base_address text;
alter table public.profiles add column if not exists emergency_contact_name text;
alter table public.profiles add column if not exists emergency_contact_relationship text;
alter table public.profiles add column if not exists emergency_contact_phone text;

create table if not exists public.company_sites (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  address text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_meters double precision not null default 120 check (radius_meters > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists company_site_id uuid references public.company_sites (id) on delete set null;

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  site_id uuid references public.company_sites (id) on delete set null,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  clock_in_latitude double precision not null check (clock_in_latitude between -90 and 90),
  clock_in_longitude double precision not null check (clock_in_longitude between -180 and 180),
  clock_out_latitude double precision check (clock_out_latitude between -90 and 90),
  clock_out_longitude double precision check (clock_out_longitude between -180 and 180),
  hours_rendered numeric(7, 2) not null default 0 check (hours_rendered >= 0),
  status public.approval_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_clock_order check (clock_out_at is null or clock_out_at >= clock_in_at)
);

create unique index if not exists attendance_one_open_log_per_intern
  on public.attendance_logs (intern_id)
  where clock_out_at is null;

create index if not exists attendance_intern_clock_in_idx
  on public.attendance_logs (intern_id, clock_in_at desc);

create index if not exists attendance_status_idx
  on public.attendance_logs (status, clock_in_at desc);

create table if not exists public.accomplishment_reports (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  attendance_log_id uuid references public.attendance_logs (id) on delete set null,
  report_date date not null default current_date,
  title text not null check (length(trim(title)) > 0),
  tasks text not null check (length(trim(tasks)) > 0),
  hours_spent numeric(5, 2) not null default 0 check (hours_spent between 0 and 24),
  status public.approval_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_intern_date_idx
  on public.accomplishment_reports (intern_id, report_date desc);

create index if not exists reports_status_idx
  on public.accomplishment_reports (status, report_date desc);

create table if not exists public.accomplishment_proofs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.accomplishment_reports (id) on delete cascade,
  intern_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('image', 'document', 'video')),
  storage_path text,
  external_url text,
  file_name text,
  mime_type text,
  created_at timestamptz not null default now(),
  constraint proof_has_source check (storage_path is not null or external_url is not null)
);

create index if not exists proofs_report_idx on public.accomplishment_proofs (report_id);

create table if not exists public.safe_checkins (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  checkin_at timestamptz not null default now(),
  checkin_date date not null default current_date,
  base_label text not null default 'Residence',
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  receipt_code text not null default ('TXN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  created_at timestamptz not null default now(),
  constraint safe_checkins_receipt_unique unique (receipt_code),
  constraint safe_checkins_one_per_day unique (intern_id, checkin_date)
);

create index if not exists safe_checkins_date_idx on public.safe_checkins (checkin_date, checkin_at desc);

create table if not exists public.transit_pings (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  coordinator_id uuid not null references public.profiles (id) on delete cascade,
  message text not null default 'Please confirm that you are safe at base.',
  created_at timestamptz not null default now()
);

create index if not exists transit_pings_intern_idx on public.transit_pings (intern_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_attendance_hours()
returns trigger
language plpgsql
as $$
begin
  if new.clock_out_at is null then
    new.hours_rendered := 0;
  else
    new.hours_rendered := round(
      greatest(extract(epoch from (new.clock_out_at - new.clock_in_at)) / 3600.0, 0)::numeric,
      2
    );
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
begin
  v_role := case
    when coalesce(new.raw_user_meta_data ->> 'role', 'intern') = 'supervisor'
      then 'supervisor'
    when coalesce(new.raw_user_meta_data ->> 'role', 'intern') = 'coordinator'
      then 'coordinator'
    else 'intern'
  end;

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'intern'), '@', 1)
  );

  insert into public.profiles (id, email, full_name, role)
  values (new.id, coalesce(new.email, ''), v_name, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.role is distinct from old.role
      or new.supervisor_id is distinct from old.supervisor_id
      or new.coordinator_id is distinct from old.coordinator_id
      or new.company_site_id is distinct from old.company_site_id
      or new.required_hours is distinct from old.required_hours
      or new.enrollment_status is distinct from old.enrollment_status
      or new.deployment_status is distinct from old.deployment_status then
      raise exception 'Restricted profile fields cannot be changed directly';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, 'intern'), '@', 1)
  ),
  case
    when coalesce(u.raw_user_meta_data ->> 'role', 'intern') = 'supervisor' then 'supervisor'
    when coalesce(u.raw_user_meta_data ->> 'role', 'intern') = 'coordinator' then 'coordinator'
    else 'intern'
  end
from auth.users u
on conflict (id) do nothing;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

drop trigger if exists company_sites_updated_at on public.company_sites;
create trigger company_sites_updated_at
  before update on public.company_sites
  for each row execute function public.set_updated_at();

drop trigger if exists attendance_hours on public.attendance_logs;
create trigger attendance_hours
  before insert or update on public.attendance_logs
  for each row execute function public.set_attendance_hours();

drop trigger if exists attendance_updated_at on public.attendance_logs;
create trigger attendance_updated_at
  before update on public.attendance_logs
  for each row execute function public.set_updated_at();

drop trigger if exists reports_updated_at on public.accomplishment_reports;
create trigger reports_updated_at
  before update on public.accomplishment_reports
  for each row execute function public.set_updated_at();

create or replace function public.haversine_distance(
  p_latitude_a double precision,
  p_longitude_a double precision,
  p_latitude_b double precision,
  p_longitude_b double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000.0 * 2.0 * asin(
    least(
      1.0,
      sqrt(
        power(sin(radians(p_latitude_b - p_latitude_a) / 2.0), 2) +
        cos(radians(p_latitude_a)) * cos(radians(p_latitude_b)) *
        power(sin(radians(p_longitude_b - p_longitude_a) / 2.0), 2)
      )
    )
  );
$$;

create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'supervisor'
  );
$$;

create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coordinator'
  );
$$;

create or replace function public.is_supervisor_of(p_intern_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_intern_id and supervisor_id = auth.uid()
  );
$$;

create or replace function public.is_coordinator_of(p_intern_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_intern_id and coordinator_id = auth.uid()
  );
$$;

create or replace function public.is_verified_intern(p_intern_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_intern_id
      and role = 'intern'
      and enrollment_status = 'approved'
      and deployment_status = 'approved'
  );
$$;

create or replace function public.list_mentors()
returns table (
  id uuid,
  full_name text,
  role text,
  organization text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.role,
    case
      when p.role = 'supervisor' then coalesce(p.company_name, '')
      when p.role = 'coordinator' then coalesce(p.university_name, '')
      else ''
    end as organization
  from public.profiles p
  where p.role in ('supervisor', 'coordinator')
  order by p.role, p.full_name;
$$;

create or replace function public.update_my_profile(
  p_full_name text default null,
  p_phone text default null,
  p_id_number text default null,
  p_university_name text default null,
  p_company_name text default null,
  p_company_address text default null,
  p_home_base_address text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_relationship text default null,
  p_emergency_contact_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = nullif(trim(p_phone), ''),
      id_number = nullif(trim(p_id_number), ''),
      university_name = nullif(trim(p_university_name), ''),
      company_name = nullif(trim(p_company_name), ''),
      company_address = nullif(trim(p_company_address), ''),
      home_base_address = nullif(trim(p_home_base_address), ''),
      emergency_contact_name = nullif(trim(p_emergency_contact_name), ''),
      emergency_contact_relationship = nullif(trim(p_emergency_contact_relationship), ''),
      emergency_contact_phone = nullif(trim(p_emergency_contact_phone), '')
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.link_intern_accounts(
  p_coordinator_id uuid,
  p_supervisor_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  select role into v_role from public.profiles where id = auth.uid();

  if v_role is distinct from 'intern' then
    raise exception 'Only interns can link school and company accounts';
  end if;

  if p_coordinator_id is null or p_supervisor_id is null then
    raise exception 'Select both a school coordinator and a company supervisor';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_coordinator_id and role = 'coordinator'
  ) then
    raise exception 'Selected coordinator account was not found';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_supervisor_id and role = 'supervisor'
  ) then
    raise exception 'Selected supervisor account was not found';
  end if;

  update public.profiles
  set coordinator_id = p_coordinator_id,
      supervisor_id = p_supervisor_id,
      enrollment_status = 'pending',
      deployment_status = 'pending',
      enrollment_feedback = null,
      deployment_feedback = null
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.review_enrollment(
  p_intern_id uuid,
  p_status public.approval_status,
  p_feedback text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if p_status = 'pending' then
    raise exception 'Verification status must be approved or rejected';
  end if;

  if not public.is_coordinator_of(p_intern_id) then
    raise exception 'This intern is not linked to your coordinator account';
  end if;

  update public.profiles
  set enrollment_status = p_status,
      enrollment_feedback = nullif(trim(p_feedback), '')
  where id = p_intern_id
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.review_deployment(
  p_intern_id uuid,
  p_status public.approval_status,
  p_feedback text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if p_status = 'pending' then
    raise exception 'Verification status must be approved or rejected';
  end if;

  if not public.is_supervisor_of(p_intern_id) then
    raise exception 'This intern is not linked to your supervisor account';
  end if;

  if p_status = 'approved' and not exists (
    select 1 from public.profiles
    where id = p_intern_id and company_site_id is not null
  ) then
    raise exception 'Assign a company site before approving deployment';
  end if;

  update public.profiles
  set deployment_status = p_status,
      deployment_feedback = nullif(trim(p_feedback), '')
  where id = p_intern_id
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.assign_intern(
  p_intern_id uuid,
  p_site_id uuid,
  p_required_hours numeric
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_supervisor() then
    raise exception 'Only supervisors can assign interns';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_intern_id and role = 'intern'
  ) then
    raise exception 'Intern profile not found';
  end if;

  if exists (
    select 1 from public.profiles
    where id = p_intern_id
      and supervisor_id is not null
      and supervisor_id <> auth.uid()
  ) then
    raise exception 'Intern is already assigned to another supervisor';
  end if;

  if p_required_hours is null or p_required_hours <= 0 then
    raise exception 'Required hours must be greater than zero';
  end if;

  if p_site_id is not null and not exists (
    select 1 from public.company_sites
    where id = p_site_id and supervisor_id = auth.uid()
  ) then
    raise exception 'Company site does not belong to you';
  end if;

  update public.profiles
  set supervisor_id = auth.uid(),
      company_site_id = p_site_id,
      required_hours = p_required_hours,
      deployment_status = case
        when company_site_id is distinct from p_site_id then 'pending'::public.approval_status
        else deployment_status
      end,
      deployment_feedback = case
        when company_site_id is distinct from p_site_id then null
        else deployment_feedback
      end
  where id = p_intern_id
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.clock_in(
  p_site_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns public.attendance_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site public.company_sites;
  v_log public.attendance_logs;
  v_role text;
  v_distance double precision;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  select role into v_role from public.profiles where id = auth.uid();

  if v_role is distinct from 'intern' then
    raise exception 'Only interns can clock in';
  end if;

  if not public.is_verified_intern(auth.uid()) then
    raise exception 'Your school enrollment and company deployment must both be verified before clocking in';
  end if;

  select * into v_site from public.company_sites where id = p_site_id;

  if not found or not v_site.is_active then
    raise exception 'Company site is unavailable';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and company_site_id = p_site_id
  ) then
    raise exception 'You are not assigned to this company site';
  end if;

  if exists (
    select 1 from public.attendance_logs
    where intern_id = auth.uid() and clock_out_at is null
  ) then
    raise exception 'You already have an open attendance log';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'A GPS location is required to clock in';
  end if;

  v_distance := public.haversine_distance(
    p_latitude,
    p_longitude,
    v_site.latitude,
    v_site.longitude
  );

  if v_distance >= v_site.radius_meters then
    raise exception 'Clock-in rejected: you are % m from the site center. The allowed radius is % m',
      round(v_distance::numeric, 1),
      round(v_site.radius_meters::numeric, 1);
  end if;

  insert into public.attendance_logs (
    intern_id,
    site_id,
    clock_in_at,
    clock_in_latitude,
    clock_in_longitude
  )
  values (
    auth.uid(),
    p_site_id,
    now(),
    p_latitude,
    p_longitude
  )
  returning * into v_log;

  return v_log;
end;
$$;

create or replace function public.clock_out(
  p_latitude double precision,
  p_longitude double precision
)
returns public.attendance_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.attendance_logs;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'A GPS location is required to clock out';
  end if;

  select * into v_log
  from public.attendance_logs
  where intern_id = auth.uid() and clock_out_at is null
  order by clock_in_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No open attendance log found';
  end if;

  update public.attendance_logs
  set clock_out_at = now(),
      clock_out_latitude = p_latitude,
      clock_out_longitude = p_longitude
  where id = v_log.id
  returning * into v_log;

  return v_log;
end;
$$;

create or replace function public.review_attendance(
  p_log_id uuid,
  p_status public.approval_status,
  p_feedback text default null
)
returns public.attendance_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.attendance_logs;
begin
  if p_status = 'pending' then
    raise exception 'Review status must be approved or rejected';
  end if;

  select * into v_log
  from public.attendance_logs
  where id = p_log_id
  for update;

  if not found then
    raise exception 'Attendance log not found';
  end if;

  if v_log.clock_out_at is null then
    raise exception 'Cannot review an attendance log that is still open';
  end if;

  if not public.is_supervisor_of(v_log.intern_id) then
    raise exception 'This attendance log does not belong to one of your interns';
  end if;

  update public.attendance_logs
  set status = p_status,
      feedback = nullif(trim(p_feedback), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_log_id
  returning * into v_log;

  return v_log;
end;
$$;

create or replace function public.review_accomplishment(
  p_report_id uuid,
  p_status public.approval_status,
  p_feedback text default null
)
returns public.accomplishment_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.accomplishment_reports;
begin
  if p_status = 'pending' then
    raise exception 'Review status must be approved or rejected';
  end if;

  select * into v_report
  from public.accomplishment_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Accomplishment report not found';
  end if;

  if not public.is_supervisor_of(v_report.intern_id) then
    raise exception 'This report does not belong to one of your interns';
  end if;

  update public.accomplishment_reports
  set status = p_status,
      feedback = nullif(trim(p_feedback), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_report_id
  returning * into v_report;

  return v_report;
end;
$$;

drop function if exists public.safe_check_in(text, double precision, double precision);

create or replace function public.safe_check_in(
  p_base_label text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_checkin_date date default null
)
returns public.safe_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_checkin public.safe_checkins;
  v_label text;
  v_date date;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.role is distinct from 'intern' then
    raise exception 'Only interns can use Safe-at-Base check-in';
  end if;

  if not public.is_verified_intern(auth.uid()) then
    raise exception 'Your account must be fully verified before using Safe-at-Base';
  end if;

  v_date := coalesce(p_checkin_date, current_date);

  if abs(v_date - current_date) > 1 then
    raise exception 'Invalid safe-at-base check-in date';
  end if;

  select * into v_checkin
  from public.safe_checkins
  where intern_id = auth.uid() and checkin_date = v_date;

  if found then
    return v_checkin;
  end if;

  v_label := coalesce(
    nullif(trim(p_base_label), ''),
    nullif(trim(v_profile.home_base_address), ''),
    'Residence'
  );

  insert into public.safe_checkins (
    intern_id,
    checkin_at,
    checkin_date,
    base_label,
    latitude,
    longitude
  )
  values (
    auth.uid(),
    now(),
    v_date,
    v_label,
    p_latitude,
    p_longitude
  )
  returning * into v_checkin;

  return v_checkin;
end;
$$;

create or replace function public.ping_intern(
  p_intern_id uuid,
  p_message text default null
)
returns public.transit_pings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ping public.transit_pings;
begin
  if not public.is_coordinator_of(p_intern_id) then
    raise exception 'This intern is not linked to your coordinator account';
  end if;

  insert into public.transit_pings (
    intern_id,
    coordinator_id,
    message
  )
  values (
    p_intern_id,
    auth.uid(),
    coalesce(nullif(trim(p_message), ''), 'Please confirm that you are safe at base.')
  )
  returning * into v_ping;

  return v_ping;
end;
$$;

drop view if exists public.intern_progress;

create view public.intern_progress
with (security_invoker = true)
as
select
  p.id as intern_id,
  p.full_name,
  p.email,
  p.required_hours,
  p.supervisor_id,
  p.company_site_id,
  coalesce(sum(case when a.status = 'approved' then a.hours_rendered else 0 end), 0)::numeric(10, 2) as approved_hours,
  coalesce(sum(case when a.status = 'pending' and a.clock_out_at is not null then a.hours_rendered else 0 end), 0)::numeric(10, 2) as pending_hours,
  count(a.id) filter (where a.status = 'pending' and a.clock_out_at is not null) as pending_reviews,
  p.coordinator_id,
  p.enrollment_status,
  p.deployment_status,
  p.phone,
  p.id_number,
  p.university_name,
  p.company_name,
  p.home_base_address,
  p.enrollment_feedback,
  p.deployment_feedback
from public.profiles p
left join public.attendance_logs a on a.intern_id = p.id
where p.role = 'intern'
group by p.id;

alter table public.profiles enable row level security;
alter table public.company_sites enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.accomplishment_reports enable row level security;
alter table public.accomplishment_proofs enable row level security;
alter table public.safe_checkins enable row level security;
alter table public.transit_pings enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_supervisor() or public.is_coordinator());

drop policy if exists company_sites_select on public.company_sites;
create policy company_sites_select on public.company_sites
  for select to authenticated
  using (true);

drop policy if exists company_sites_insert on public.company_sites;
create policy company_sites_insert on public.company_sites
  for insert to authenticated
  with check (supervisor_id = auth.uid() and public.is_supervisor());

drop policy if exists company_sites_update on public.company_sites;
create policy company_sites_update on public.company_sites
  for update to authenticated
  using (supervisor_id = auth.uid())
  with check (supervisor_id = auth.uid());

drop policy if exists company_sites_delete on public.company_sites;
create policy company_sites_delete on public.company_sites
  for delete to authenticated
  using (supervisor_id = auth.uid());

drop policy if exists attendance_select on public.attendance_logs;
create policy attendance_select on public.attendance_logs
  for select to authenticated
  using (
    intern_id = auth.uid()
    or public.is_supervisor_of(intern_id)
    or public.is_coordinator_of(intern_id)
  );

drop policy if exists reports_select on public.accomplishment_reports;
create policy reports_select on public.accomplishment_reports
  for select to authenticated
  using (
    intern_id = auth.uid()
    or public.is_supervisor_of(intern_id)
    or public.is_coordinator_of(intern_id)
  );

drop policy if exists reports_insert on public.accomplishment_reports;
create policy reports_insert on public.accomplishment_reports
  for insert to authenticated
  with check (
    intern_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and public.is_verified_intern(auth.uid())
  );

drop policy if exists reports_delete_pending on public.accomplishment_reports;
create policy reports_delete_pending on public.accomplishment_reports
  for delete to authenticated
  using (intern_id = auth.uid() and status = 'pending');

drop policy if exists proofs_select on public.accomplishment_proofs;
create policy proofs_select on public.accomplishment_proofs
  for select to authenticated
  using (
    intern_id = auth.uid()
    or public.is_supervisor_of(intern_id)
    or public.is_coordinator_of(intern_id)
  );

drop policy if exists proofs_insert on public.accomplishment_proofs;
create policy proofs_insert on public.accomplishment_proofs
  for insert to authenticated
  with check (
    intern_id = auth.uid()
    and exists (
      select 1 from public.accomplishment_reports r
      where r.id = report_id
        and r.intern_id = auth.uid()
        and r.status = 'pending'
    )
  );

drop policy if exists proofs_delete on public.accomplishment_proofs;
create policy proofs_delete on public.accomplishment_proofs
  for delete to authenticated
  using (
    intern_id = auth.uid()
    and exists (
      select 1 from public.accomplishment_reports r
      where r.id = report_id
        and r.intern_id = auth.uid()
        and r.status = 'pending'
    )
  );

drop policy if exists safe_checkins_select on public.safe_checkins;
create policy safe_checkins_select on public.safe_checkins
  for select to authenticated
  using (
    intern_id = auth.uid()
    or public.is_supervisor_of(intern_id)
    or public.is_coordinator_of(intern_id)
  );

drop policy if exists transit_pings_select on public.transit_pings;
create policy transit_pings_select on public.transit_pings
  for select to authenticated
  using (coordinator_id = auth.uid() or intern_id = auth.uid());

revoke execute on all functions in schema public from public, anon;
revoke all on public.profiles from anon, authenticated;
revoke all on public.company_sites from anon, authenticated;
revoke all on public.attendance_logs from anon, authenticated;
revoke all on public.accomplishment_reports from anon, authenticated;
revoke all on public.accomplishment_proofs from anon, authenticated;
revoke all on public.safe_checkins from anon, authenticated;
revoke all on public.transit_pings from anon, authenticated;
revoke all on public.intern_progress from anon, authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.company_sites to authenticated;
grant select on public.attendance_logs to authenticated;
grant select, insert, delete on public.accomplishment_reports to authenticated;
grant select, insert, delete on public.accomplishment_proofs to authenticated;
grant select on public.safe_checkins to authenticated;
grant select on public.transit_pings to authenticated;
grant select on public.intern_progress to authenticated;

grant execute on function public.list_mentors() to authenticated;
grant execute on function public.update_my_profile(text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.link_intern_accounts(uuid, uuid) to authenticated;
grant execute on function public.review_enrollment(uuid, public.approval_status, text) to authenticated;
grant execute on function public.review_deployment(uuid, public.approval_status, text) to authenticated;
grant execute on function public.clock_in(uuid, double precision, double precision) to authenticated;
grant execute on function public.clock_out(double precision, double precision) to authenticated;
grant execute on function public.review_attendance(uuid, public.approval_status, text) to authenticated;
grant execute on function public.review_accomplishment(uuid, public.approval_status, text) to authenticated;
grant execute on function public.assign_intern(uuid, uuid, numeric) to authenticated;
grant execute on function public.safe_check_in(text, double precision, double precision, date) to authenticated;
grant execute on function public.ping_intern(uuid, text) to authenticated;
grant execute on function public.is_supervisor() to authenticated;
grant execute on function public.is_coordinator() to authenticated;
grant execute on function public.is_supervisor_of(uuid) to authenticated;
grant execute on function public.is_coordinator_of(uuid) to authenticated;
grant execute on function public.is_verified_intern(uuid) to authenticated;
grant execute on function public.haversine_distance(double precision, double precision, double precision, double precision) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'accomplishment-proofs',
  'accomplishment-proofs',
  false,
   52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists trainext_proofs_read on storage.objects;
create policy trainext_proofs_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'accomplishment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_supervisor_of(((storage.foldername(name))[1])::uuid)
      or public.is_coordinator_of(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists trainext_proofs_insert on storage.objects;
create policy trainext_proofs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'accomplishment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.accomplishment_reports r
      where r.intern_id = auth.uid()
        and r.status = 'pending'
        and storage.objects.name like auth.uid()::text || '/' || r.id::text || '/%'
    )
  );

drop policy if exists trainext_proofs_delete on storage.objects;
create policy trainext_proofs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'accomplishment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.accomplishment_reports r
      where r.intern_id = auth.uid()
        and r.status = 'pending'
        and storage.objects.name like auth.uid()::text || '/' || r.id::text || '/%'
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.attendance_logs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.accomplishment_reports;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.safe_checkins;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.transit_pings;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
