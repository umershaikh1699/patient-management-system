import { useState, useEffect, useRef, type FormEvent } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { GenderBadge } from '../components/Badge'
import { PlusIcon, SearchIcon, EditIcon, TrashIcon } from '../components/Icons'
import { patientApi } from '../services/api'
import { extractErrors, type Patient, type PatientFormData } from '../types'

const EMPTY: PatientFormData = { name: '', gender: '', email: '' }
const PAGE_SIZE = 20

function PatientModal({
  patient, onClose, onSaved,
}: { patient: Patient | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PatientFormData>(
    patient ? { name: patient.name, gender: patient.gender, email: patient.email } : EMPTY
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const set = (k: keyof PatientFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSaving(true)
    try {
      if (patient) await patientApi.update(patient.id, form)
      else await patientApi.create(form as PatientFormData)
      onSaved()
    } catch (err) {
      setErrors(extractErrors(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={patient ? 'Edit Patient' : 'Add Patient'}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {saving ? <><span className="spin" />{patient ? ' Saving…' : ' Adding…'}</> : patient ? 'Save Changes' : 'Add Patient'}
          </button>
        </>
      }
    >
      {errors.non_field_errors && <div className="fapi-err">{errors.non_field_errors}</div>}
      <form ref={formRef} onSubmit={submit}>
        <div className="form-grid">
          <div className="fg full">
            <label>Full Name *</label>
            <input className={`fi ${errors.name ? 'err' : ''}`} type="text" placeholder="Patient's full name" value={form.name} onChange={set('name')} required />
            {errors.name && <span className="fe">{errors.name}</span>}
          </div>
          <div className="fg">
            <label>Gender *</label>
            <select className={`fi ${errors.gender ? 'err' : ''}`} value={form.gender} onChange={set('gender')} required>
              <option value="">Select…</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
            {errors.gender && <span className="fe">{errors.gender}</span>}
          </div>
          <div className="fg">
            <label>Email</label>
            <input className={`fi ${errors.email ? 'err' : ''}`} type="email" placeholder="patient@example.com" value={form.email} onChange={set('email')} />
            {errors.email && <span className="fe">{errors.email}</span>}
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; patient: Patient | null }>({ open: false, patient: null })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const fetch = () => {
    setLoading(true)
    patientApi.list({ search: search || undefined, page, page_size: PAGE_SIZE })
      .then(({ data }) => { setPatients(data.results); setTotal(data.count) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { fetch() }, [search, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => setModal({ open: true, patient: null })
  const openEdit = (p: Patient) => setModal({ open: true, patient: p })
  const closeModal = () => setModal({ open: false, patient: null })
  const onSaved = () => { closeModal(); fetch() }

  const remove = async (id: number) => {
    setDeletingId(id)
    setConfirmingId(null)
    try { await patientApi.remove(id); fetch() }
    finally { setDeletingId(null) }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="Patients">
      <div className="page-hd">
        <div className="page-hd-left">
          <h1>Patients</h1>
          <p>{total} patient{total !== 1 ? 's' : ''} registered</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><PlusIcon />Add Patient</button>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="input-wrap">
            <SearchIcon />
            <input
              className="search-box"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-box"><div className="spin spin-lg" /></div>
        ) : patients.length === 0 ? (
          <div className="empty">
            <UsersIconEmpty />
            <p>{search ? 'No patients match your search.' : 'No patients yet.'}</p>
            {!search && <span>Click "Add Patient" to get started.</span>}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Email</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id}>
                    <td className="cell-bold">{p.name}</td>
                    <td><GenderBadge gender={p.gender} /></td>
                    <td className="cell-dim">{p.email || '—'}</td>
                    <td className="cell-dim">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      {confirmingId === p.id ? (
                        <div className="cell-actions">
                          <span className="cell-dim" style={{ fontSize: 12 }}>Delete?</span>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)} disabled={deletingId === p.id}>Yes</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)}>No</button>
                        </div>
                      ) : (
                        <div className="cell-actions">
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(p)}><EditIcon /></button>
                          <button className="btn-icon del" title="Delete" disabled={deletingId === p.id} onClick={() => setConfirmingId(p.id)}>
                            {deletingId === p.id ? <span className="spin" /> : <TrashIcon />}
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

      {modal.open && <PatientModal patient={modal.patient} onClose={closeModal} onSaved={onSaved} />}
    </Layout>
  )
}

function UsersIconEmpty() {
  return <svg fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" style={{ width: 40, height: 40, color: 'var(--gray-300)', margin: '0 auto 10px', display: 'block' }}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
}
