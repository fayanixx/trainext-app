export type UserRole = 'intern' | 'supervisor' | 'coordinator';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type AttendanceStatus = 'on_duty' | 'in_transit' | 'safe_at_base';

// 1. Profile Type para sa lahat ng users
export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  contact_number?: string;
  home_address?: string;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

// 2. Company Site Type (Tanging si Supervisor ang nagmamay-ari)
export interface CompanySite {
  id: string;
  supervisor_id: string;
  company_name: string;
  office_address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  created_at?: string;
  updated_at?: string;
}

// 3. Smart Link Type (Intern <-> Supervisor Request)
export interface InternSupervisorLink {
  id: string;
  intern_id: string;
  supervisor_id: string;
  status: RequestStatus;
  rejection_reason?: string | null;
  linked_at?: string | null;
  created_at?: string;
  // Joins para sa UI queries
  supervisor?: UserProfile & {
    company_sites?: CompanySite[];
  };
  intern?: UserProfile;
}

// 4. Attendance & Geofenced DTR Record
  export interface AttendanceLog {
    id: string;
    intern_id: string;
    supervisor_id?: string | null;
    date: string;
    time_in: string;
    time_out?: string | null;
    hours_rendered?: number;
    status: 'on_duty' | 'in_transit' | 'safe_at_base' | 'completed' | 'absent';
    safe_at_base_time?: string | null;
    safe_location_lat?: number | null;
    safe_location_lng?: number | null;
    transit_notes?: string | null;
    created_at?: string;
  }

// 5. Accomplishment Log with Multi-Proof Support
export interface AccomplishmentLog {
  id: string;
  intern_id: string;
  supervisor_id?: string;
  title: string;
  description: string;
  report_date: string;
  rendered_hours: number;
  proof_images: string[];
  proof_documents: string[];
  video_url?: string | null;
  status: RequestStatus;
  feedback?: string | null;
  approved_at?: string | null;
  created_at?: string;
  intern?: UserProfile;
}

// 6. Geolocation State Tracker
export interface GeoLocationState {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  error: string | null;
  loading: boolean;
}