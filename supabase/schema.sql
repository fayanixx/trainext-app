-- =========================================================================
-- TRAINEXT DATABASE SCHEMA (POSTGRESQL / SUPABASE)
-- =========================================================================

-- 1. PROFILES TABLE (Users, Interns, Supervisors, Coordinators)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY,
    email text,
    full_name text NOT NULL DEFAULT ''::text,
    role text DEFAULT 'intern'::text,
    supervisor_id uuid,
    required_hours numeric NOT NULL DEFAULT 486,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    company_site_id uuid,
    coordinator_id uuid,
    enrollment_status approval_status NOT NULL DEFAULT 'pending'::approval_status,
    deployment_status approval_status NOT NULL DEFAULT 'pending'::approval_status,
    enrollment_feedback text,
    deployment_feedback text,
    phone text,
    id_number text
);

-- 2. COMPANY SITES TABLE (Geofencing Workplaces)
CREATE TABLE IF NOT EXISTS public.company_sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id uuid NOT NULL,
    company_name text NOT NULL,
    office_address text NOT NULL DEFAULT ''::text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    radius_meters double precision NOT NULL DEFAULT 120,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. INTERN SUPERVISOR LINKS TABLE
CREATE TABLE IF NOT EXISTS public.intern_supervisor_links (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    intern_id uuid,
    supervisor_id uuid,
    status request_status DEFAULT 'pending'::request_status,
    rejection_reason text,
    linked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. ATTENDANCE LOGS TABLE (DTR, Time-in, Time-out, Safety & Transit)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intern_id uuid NOT NULL,
    site_id uuid,
    hours_rendered numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'on_duty'::text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    feedback text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    supervisor_id uuid,
    date date NOT NULL DEFAULT CURRENT_DATE,
    time_in timestamp with time zone NOT NULL DEFAULT now(),
    time_in_lat double precision,
    time_in_lng double precision,
    time_out timestamp with time zone,
    safe_at_base_time timestamp with time zone,
    transit_waiver_agreed boolean DEFAULT false,
    safe_location_lat double precision,
    safe_location_lng double precision,
    transit_notes text,
    time_out_lat double precision,
    time_out_lng double precision,
    am_arrival time without time zone,
    am_departure time without time zone,
    pm_arrival time without time zone,
    pm_departure time without time zone,
    under_time_hours numeric DEFAULT 0.00,
    under_time_minutes integer DEFAULT 0
);

-- 5. ACCOMPLISHMENT REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.accomplishment_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intern_id uuid NOT NULL,
    attendance_log_id uuid,
    report_date date NOT NULL DEFAULT CURRENT_DATE,
    title text NOT NULL,
    tasks text DEFAULT ''::text,
    hours_spent numeric DEFAULT 0,
    status approval_status NOT NULL DEFAULT 'pending'::approval_status,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    feedback text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    description text,
    rendered_hours numeric DEFAULT 0,
    proof_images text[] DEFAULT '{}'::text[],
    proof_documents text[] DEFAULT '{}'::text[],
    video_url text,
    task_description text DEFAULT ''::text,
    work_mode text DEFAULT 'onsite'::text,
    approved_at timestamp with time zone,
    supervisor_id uuid
);

-- 6. ACCOMPLISHMENT PROOFS TABLE
CREATE TABLE IF NOT EXISTS public.accomplishment_proofs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL,
    intern_id uuid NOT NULL,
    kind text NOT NULL,
    storage_path text,
    external_url text,
    file_name text,
    mime_type text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 7. INTERN PROGRESS VIEW / TABLE MAPPING
CREATE TABLE IF NOT EXISTS public.intern_progress (
    intern_id uuid,
    full_name text,
    email text,
    required_hours numeric,
    total_hours_rendered numeric,
    progress_percentage numeric,
    current_status text
);
