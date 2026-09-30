import { STATUS_LABELS, GENDER_LABELS, type AppointmentStatus, type Gender } from '../types'

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}

export function GenderBadge({ gender }: { gender: Gender }) {
  return <span className={`badge badge-${gender}`}>{GENDER_LABELS[gender]}</span>
}
