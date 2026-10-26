export type UserRole = 'intern' | 'supervisor' | 'coordinator'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ProofKind = 'image' | 'document' | 'video'
export type TransitState = 'safe' | 'in_transit' | 'delayed'
export type ApprovalCadence = 'daily' | 'weekly' | 'monthly'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  supervisor_id: string | null
  coordinator_id: string | null
  company_site_id: string | null
  required_hours: number
  enrollment_status: ApprovalStatus
  deployment_status: ApprovalStatus
  enrollment_feedback: string | null
  deployment_feedback: string | null
  phone: string | null
  id_number: string | null
  university_name: string | null
  company_name: string | null
  company_address: string | null
  home_base_address: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  created_at: string
  updated_at: string
}

export interface CompanySite {
  id: string
  supervisor_id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AttendanceLog {
  id: string
  intern_id: string
  site_id: string | null
  clock_in_at: string
  clock_out_at: string | null
  clock_in_latitude: number
  clock_in_longitude: number
  clock_out_latitude: number | null
  clock_out_longitude: number | null
  hours_rendered: number
  status: ApprovalStatus
  reviewed_by: string | null
  reviewed_at: string | null
  feedback: string | null
  created_at: string
  updated_at: string
}

export interface AccomplishmentProof {
  id: string
  report_id: string
  intern_id: string
  kind: ProofKind
  storage_path: string | null
  external_url: string | null
  file_name: string | null
  mime_type: string | null
  created_at: string
}

export interface AccomplishmentReport {
  id: string
  intern_id: string
  attendance_log_id: string | null
  report_date: string
  title: string
  tasks: string
  hours_spent: number
  status: ApprovalStatus
  reviewed_by: string | null
  reviewed_at: string | null
  feedback: string | null
  created_at: string
  updated_at: string
  proofs?: AccomplishmentProof[]
}

export interface SafeCheckin {
  id: string
  intern_id: string
  checkin_at: string
  checkin_date: string
  base_label: string
  latitude: number | null
  longitude: number | null
  receipt_code: string
  created_at: string
}

export interface TransitPing {
  id: string
  intern_id: string
  coordinator_id: string
  message: string
  created_at: string
}

export interface MentorOption {
  id: string
  full_name: string
  role: Extract<UserRole, 'supervisor' | 'coordinator'>
  organization: string
}

export interface ProfileUpdateInput {
  full_name: string
  phone: string
  id_number: string
  university_name: string
  company_name: string
  company_address: string
  home_base_address: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
}

export interface InternProgress {
  intern_id: string
  full_name: string
  email: string
  required_hours: number
  supervisor_id: string | null
  company_site_id: string | null
  approved_hours: number
  pending_hours: number
  pending_reviews: number
  coordinator_id: string | null
  enrollment_status: ApprovalStatus
  deployment_status: ApprovalStatus
  phone: string | null
  id_number: string | null
  university_name: string | null
  company_name: string | null
  home_base_address: string | null
  enrollment_feedback: string | null
  deployment_feedback: string | null
}

export interface TransitFeedRow {
  intern: InternProgress
  state: TransitState
  checkin: SafeCheckin | null
  openLog: AttendanceLog | null
  lastLog: AttendanceLog | null
  lastPing: TransitPing | null
}

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy: number | null
  timestamp: number
}

export interface SiteInput {
  name: string
  address: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
}

export interface ProofUpload {
  file: File
  kind: ProofKind
}
