export type Gender = 'M' | 'F' | 'O'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Clinic {
  id: number
  email: string
  name: string
}

export interface Clinician {
  id: number
  name: string
  specialization: string
  email: string
  created_at: string
}

export interface Patient {
  id: number
  name: string
  gender: Gender
  email: string
  created_at: string
  updated_at: string
}

export interface AppointmentClinician {
  id: number
  clinician: number
  clinician_name: string
}

export interface AppointmentPatient {
  id: number
  name: string
  gender: Gender
}

export interface Appointment {
  id: number
  patient: number
  patient_detail: AppointmentPatient
  scheduled_at: string
  duration_minutes: number
  status: AppointmentStatus
  created_at: string
  updated_at: string
  appointment_clinicians: AppointmentClinician[]
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface PatientFormData {
  name: string
  gender: Gender | ''
  email: string
}

export interface ClinicianFormData {
  name: string
  specialization: string
  email: string
}

export interface AppointmentFormData {
  patient: number | ''
  scheduled_at: string
  duration_minutes: number
  status: AppointmentStatus
  clinician_ids: number[]
}

export const GENDER_LABELS: Record<string, string> = { M: 'Male', F: 'Female', O: 'Other' }

export const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function toInputDatetime(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { timeZoneName: undefined }).slice(0, 16).replace(' ', 'T')
}

export function fromInputDatetime(local: string): string {
  return new Date(local).toISOString()
}

export function defaultDatetime(): string {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

export function extractErrors(err: unknown): Record<string, string> {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (!data || typeof data !== 'object') return { non_field_errors: 'An unexpected error occurred.' }
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    result[k] = Array.isArray(v) ? (v[0] as string) : String(v)
  }
  return result
}
