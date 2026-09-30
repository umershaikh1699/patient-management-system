import { useState, useEffect, useRef, type FormEvent } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { PlusIcon, SearchIcon, EditIcon, TrashIcon } from '../components/Icons'
import { clinicianApi } from '../services/api'
import { extractErrors, type Clinician, type ClinicianFormData } from '../types'

const EMPTY: ClinicianFormData = { name: '', specialization: '', email: '' }
const PAGE_SIZE = 20

function ClinicianModal({
  clinician, onClose, onSaved,
}: { clinician: Clinician | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ClinicianFormData>(
    clinician
      ? { name: clinician.name, specialization: clinician.specialization, email: clinician.email }
      : EMPTY
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const set = (k: keyof ClinicianFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSaving(true)
    try {
      if (clinician) await clinicianApi.update(clinician.id, form)
      else await clinicianApi.create(form)
      onSaved()
    } catch (err) {
      setErrors(extractErrors(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={clinician ? 'Edit Clinician' : 'Add Clinician'}
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
            {saving ? <><span className="spin" />{clinician ? ' Saving…' : ' Adding…'}</> : clinician ? 'Save Changes' : 'Add Clinician'}
          </button>
        </>
      }
    >
      {errors.non_field_errors && <div className="fapi-err">{errors.non_field_errors}</div>}
      <form ref={formRef} onSubmit={submit}>
        <div className="form-grid">
          <div className="fg full">
            <label>Full Name *</label>
            <input className={`fi ${errors.name ? 'err' : ''}`} type="text" placeholder="Dr. Jane Smith" value={form.name} onChange={set('name')} required />
            {errors.name && <span className="fe">{errors.name}</span>}
          </div>
          <div className="fg">
            <label>Specialization</label>
            <input className={`fi ${errors.specialization ? 'err' : ''}`} type="text" placeholder="e.g. Cardiologist" value={form.specialization} onChange={set('specialization')} />
            {errors.specialization && <span className="fe">{errors.specialization}</span>}
          </div>
          <div className="fg">
            <label>Email</label>
            <input className={`fi ${errors.email ? 'err' : ''}`} type="email" placeholder="dr.smith@clinic.com" value={form.email} onChange={set('email')} />
            {errors.email && <span className="fe">{errors.email}</span>}
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function CliniciansPage() {
  const [clinicians, setClinicians] = useState<Clinician[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; clinician: Clinician | null }>({ open: false, clinician: null })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetch = () => {
    setLoading(true)
    clinicianApi.list({ search: search || undefined, page, page_size: PAGE_SIZE })
      .then(({ data }) => { setClinicians(data.results); setTotal(data.count) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { fetch() }, [search, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => setModal({ open: true, clinician: null })
  const openEdit = (c: Clinician) => setModal({ open: true, clinician: c })
  const closeModal = () => setModal({ open: false, clinician: null })
  const onSaved = () => { closeModal(); fetch() }

  const remove = async (id: number) => {
    setDeletingId(id)
    setConfirmingId(null)
    setDeleteError(null)
    try {
      await clinicianApi.remove(id)
      fetch()
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail ?? 'Failed to delete clinician.')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="Clinicians">
      <div className="page-hd">
        <div className="page-hd-left">
          <h1>Clinicians</h1>
          <p>{total} clinician{total !== 1 ? 's' : ''} in your clinic</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><PlusIcon />Add Clinician</button>
      </div>

      <div className="card">
        {deleteError && (
          <div className="fapi-err" style={{ margin: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{deleteError}</span>
            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 }} onClick={() => setDeleteError(null)}>×</button>
          </div>
        )}
        <div className="toolbar">
          <div className="input-wrap">
            <SearchIcon />
            <input
              className="search-box"
              placeholder="Search by name, specialization or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-box"><div className="spin spin-lg" /></div>
        ) : clinicians.length === 0 ? (
          <div className="empty">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" style={{ width: 40, height: 40, color: 'var(--gray-300)', margin: '0 auto 10px', display: 'block' }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            <p>{search ? 'No clinicians match your search.' : 'No clinicians yet.'}</p>
            {!search && <span>Click "Add Clinician" to get started.</span>}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Specialization</th>
                  <th>Email</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clinicians.map(c => (
                  <tr key={c.id}>
                    <td className="cell-bold">{c.name}</td>
                    <td>{c.specialization || <span className="cell-dim">—</span>}</td>
                    <td className="cell-dim">{c.email || '—'}</td>
                    <td className="cell-dim">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      {confirmingId === c.id ? (
                        <div className="cell-actions">
                          <span className="cell-dim" style={{ fontSize: 12 }}>Delete?</span>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)} disabled={deletingId === c.id}>Yes</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)}>No</button>
                        </div>
                      ) : (
                        <div className="cell-actions">
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(c)}><EditIcon /></button>
                          <button className="btn-icon del" title="Delete" disabled={deletingId === c.id} onClick={() => setConfirmingId(c.id)}>
                            {deletingId === c.id ? <span className="spin" /> : <TrashIcon />}
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

      {modal.open && <ClinicianModal clinician={modal.clinician} onClose={closeModal} onSaved={onSaved} />}
    </Layout>
  )
}
