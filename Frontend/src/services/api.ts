import axios from 'axios'
import type { Clinic, Clinician, Patient, Appointment, PaginatedResponse, PatientFormData, ClinicianFormData, AppointmentFormData } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export const client = axios.create({ baseURL: BASE })

client.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  res => res,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean }
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/auth/token/refresh/`, { refresh })
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return client(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email: string, password: string) =>
    client.post<{ access: string; refresh: string; clinic: Clinic }>('/auth/login/', { email, password }),
  register: (data: { email: string; password: string; name: string }) =>
    client.post<{ id: number; email: string; name: string }>('/auth/register/', data),
  me: () => client.get<Clinic>('/auth/me/'),
  updateMe: (data: Partial<Pick<Clinic, 'email' | 'name'>>) => client.patch<Clinic>('/auth/me/', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    client.post('/auth/change-password/', data),
}

export const patientApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Patient>>('/patients/', { params }),
  create: (data: PatientFormData) => client.post<Patient>('/patients/', data),
  update: (id: number, data: Partial<PatientFormData>) => client.patch<Patient>(`/patients/${id}/`, data),
  remove: (id: number) => client.delete(`/patients/${id}/`),
}

export const clinicianApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Clinician>>('/clinicians/', { params }),
  create: (data: ClinicianFormData) => client.post<Clinician>('/clinicians/', data),
  update: (id: number, data: Partial<ClinicianFormData>) => client.patch<Clinician>(`/clinicians/${id}/`, data),
  remove: (id: number) => client.delete(`/clinicians/${id}/`),
}

export const appointmentApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Appointment>>('/appointments/', { params }),
  create: (data: AppointmentFormData) => client.post<Appointment>('/appointments/', data),
  update: (id: number, data: Partial<AppointmentFormData>) =>
    client.patch<Appointment>(`/appointments/${id}/`, data),
  remove: (id: number) => client.delete(`/appointments/${id}/`),
}
