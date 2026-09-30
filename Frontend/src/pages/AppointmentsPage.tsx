import { useState, useEffect, useRef, type FormEvent } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { StatusBadge, GenderBadge } from '../components/Badge'
import { PlusIcon, SearchIcon, EditIcon, TrashIcon } from '../components/Icons'
import { patientApi, clinicianApi, appointmentApi } from '../services/api'
import {
  extractErrors, formatDateTime, formatDuration,
  toInputDatetime, fromInputDatetime, defaultDatetime,
  type Appointment, type AppointmentFormData, type Patient, type Clinician,
} from '../types'

const PAGE_SIZE = 20

const EMPTY_FORM: AppointmentFormData = {
  patient: '',
  scheduled_at: defaultDatetime(),
  duration_minutes: 30,
  status: 'scheduled',
  clinician_ids: [],
}

function AppointmentModal({
  appointment, onClose, onSaved,
}: { appointment: Appointment | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AppointmentFormData>(() =>
    appointment
      ? {
          patient: appointment.patient,
          scheduled_at: toInputDatetime(appointment.scheduled_at),
          duration_minutes: appointment.duration_minutes,
          status: appointment.status,
          clinician_ids: appointment.appointment_clinicians.map(ac => ac.clinician),
        }
      : EMPTY_FORM
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [clinicians, setClinicians] = useState<Clinician[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    Promise.all([
      patientApi.list({ page_size: 200 }),
      clinicianApi.list({ page_size: 200 }),
    ]).then(([p, c]) => {
      setPatients(p.data.results)
      setClinicians(c.data.results)
    }).finally(() => setLoadingOptions(false))
  }, [])

  const toggleClinician = (id: number) => {
    setForm(f => ({
      ...f,
      clinician_ids: f.clinician_ids.includes(id)
        ? f.clinician_ids.filter(x => x !== id)
        : [...f.clinician_ids, id],
    }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (form.clinician_ids.length === 0) {
      setErrors({ clinician_ids: 'At least one clinician is required.' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        scheduled_at: fromInputDatetime(form.scheduled_at as string),
      }
      if (appointment) await appointmentApi.update(appointment.id, payload)
      else await appointmentApi.create(payload as AppointmentFormData)
      onSaved()
    } catch (err) {
      setErrors(extractErrors(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={appointment ? 'Edit Appointment' : 'New Appointment'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || loadingOptions}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {saving
              ? <><span className="spin" />{appointment ? ' Saving…' : ' Creating…'}</>
              : appointment ? 'Save Changes' : 'Create Appointment'}
          </button>
        </>
      }
    >
      {errors.non_field_errors && <div className="fapi-err">{errors.non_field_errors}</div>}
      {errors.detail && <div className="fapi-err">{errors.detail}</div>}

      {loadingOptions ? (
        <div className="loading-box"><div className="spin spin-lg" /></div>
      ) : (
        <form ref={formRef} onSubmit={submit}>
          <div className="form-grid">
            <div className="fg full">
              <label>Patient *</label>
              <select
                className={`fi ${errors.patient ? 'err' : ''}`}
                value={form.patient}
                onChange={e => setForm(f => ({ ...f, patient: Number(e.target.value) || '' }))}
                required
              >
                <option value="">Select patient…</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.patient && <span className="fe">{errors.patient}</span>}
              {patients.length === 0 && (
                <span className="fe">No patients found. Add a patient first.</span>
              )}
            </div>

            <div className="fg">
              <label>Date &amp; Time *</label>
              <input
                className={`fi ${errors.scheduled_at ? 'err' : ''}`}
                type="datetime-local"
                value={form.scheduled_at as string}
                onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                required
              />
              {errors.scheduled_at && <span className="fe">{errors.scheduled_at}</span>}
            </div>

            <div className="fg">
              <label>Duration (minutes) *</label>
              <input
                className={`fi ${errors.duration_minutes ? 'err' : ''}`}
                type="number"
                min={5}
                max={480}
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
                required
              />
              {errors.duration_minutes && <span className="fe">{errors.duration_minutes}</span>}
            </div>

            {appointment && (
              <div className="fg full">
                <label>Status</label>
                <select
                  className={`fi ${errors.status ? 'err' : ''}`}
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as AppointmentFormData['status'] }))}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
                {errors.status && <span className="fe">{errors.status}</span>}
              </div>
            )}

            <div className="fg full">
              <label>Clinicians *</label>
              {clinicians.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--gray-400)', margin: '4px 0' }}>No clinicians found.</p>
              ) : (
                <div className="cb-group">
                  {clinicians.map(c => (
                    <label key={c.id} className="cb-item">
                      <input
                        type="checkbox"
                        checked={form.clinician_ids.includes(c.id)}
                        onChange={() => toggleClinician(c.id)}
                      />
                      <div className="cb-item-info">
                        <span className="cb-item-name">{c.name}</span>
                        {c.specialization && <span className="cb-item-sub">{c.specialization}</span>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {errors.clinician_ids && <span className="fe">{errors.clinician_ids}</span>}
            </div>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; appointment: Appointment | null }>({ open: false, appointment: null })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const fetch = () => {
    setLoading(true)
    appointmentApi.list({
      search: search || undefined,
      status: statusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: PAGE_SIZE,
      ordering: 'scheduled_at',
    })
      .then(({ data }) => { setAppointments(data.results); setTotal(data.count) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1) }, [search, statusFilter, dateFrom, dateTo])
  useEffect(() => { fetch() }, [search, statusFilter, dateFrom, dateTo, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => setModal({ open: true, appointment: null })
  const openEdit = (a: Appointment) => setModal({ open: true, appointment: a })
  const closeModal = () => setModal({ open: false, appointment: null })
  const onSaved = () => { closeModal(); fetch() }

  const remove = async (id: number) => {
    setDeletingId(id)
    setConfirmingId(null)
    try { await appointmentApi.remove(id); fetch() }
    finally { setDeletingId(null) }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="Appointments">
      <div className="page-hd">
        <div className="page-hd-left">
          <h1>Appointments</h1>
          <p>{total} appointment{total !== 1 ? 's' : ''} found</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><PlusIcon />New Appointment</button>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="input-wrap">
            <SearchIcon />
            <input
              className="search-box"
              placeholder="Search by patient name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="fi filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
          <input className="fi filter-date" type="date" title="From date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input className="fi filter-date" type="date" title="To date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>

        {loading ? (
          <div className="loading-box"><div className="spin spin-lg" /></div>
        ) : appointments.length === 0 ? (
          <div className="empty">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" style={{ width: 40, height: 40, color: 'var(--gray-300)', margin: '0 auto 10px', display: 'block' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <p>{search || statusFilter || dateFrom || dateTo ? 'No appointments match your filters.' : 'No appointments yet.'}</p>
            {!search && !statusFilter && !dateFrom && !dateTo && <span>Click "New Appointment" to get started.</span>}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date &amp; Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Clinicians</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div className="cell-bold">{a.patient_detail.name}</div>
                      <div style={{ marginTop: 2 }}><GenderBadge gender={a.patient_detail.gender} /></div>
                    </td>
                    <td className="cell-dim">{formatDateTime(a.scheduled_at)}</td>
                    <td className="cell-dim">{formatDuration(a.duration_minutes)}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      {a.appointment_clinicians.length === 0 ? (
                        <span className="cell-dim">—</span>
                      ) : (
                        <div className="chips">
                          {a.appointment_clinicians.map(ac => (
                            <span key={ac.id} className="chip">{ac.clinician_name}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {confirmingId === a.id ? (
                        <div className="cell-actions">
                          <span className="cell-dim" style={{ fontSize: 12 }}>Delete?</span>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)} disabled={deletingId === a.id}>Yes</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)}>No</button>
                        </div>
                      ) : (
                        <div className="cell-actions">
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(a)}><EditIcon /></button>
                          <button className="btn-icon del" title="Delete" disabled={deletingId === a.id} onClick={() => setConfirmingId(a.id)}>
                            {deletingId === a.id ? <span className="spin" /> : <TrashIcon />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pager">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="pager-btns">
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {modal.open && <AppointmentModal appointment={modal.appointment} onClose={closeModal} onSaved={onSaved} />}
    </Layout>
  )
}
