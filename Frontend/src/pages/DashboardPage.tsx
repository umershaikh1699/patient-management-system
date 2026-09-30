import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { StatusBadge, GenderBadge } from '../components/Badge'
import { UsersIcon, UserIcon, CalendarIcon } from '../components/Icons'
import { patientApi, clinicianApi, appointmentApi } from '../services/api'
import { formatDateTime, formatDuration, type Appointment } from '../types'

interface Stats { patients: number; clinicians: number; todayCount: number }

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({ patients: 0, clinicians: 0, todayCount: 0 })
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      patientApi.list({ page_size: 1 }),
      clinicianApi.list({ page_size: 1 }),
      appointmentApi.list({ page_size: 1, date_from: today, date_to: today }),
      appointmentApi.list({ page_size: 5, status: 'scheduled', date_from: today, ordering: 'scheduled_at' }),
    ]).then(([p, c, t, u]) => {
      setStats({ patients: p.data.count, clinicians: c.data.count, todayCount: t.data.count })
      setUpcoming(u.data.results)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <Layout title="Dashboard">
      <div className="page-hd">
        <div className="page-hd-left">
          <h1>Overview</h1>
          <p>Here's what's happening at your clinic today.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-icon-wrap stat-icon-blue"><UsersIcon /></div>
          {loading ? <div className="spin" /> : <div className="stat-val">{stats.patients}</div>}
          <div className="stat-lbl">Total Patients</div>
        </div>
        <div className="stat">
          <div className="stat-icon-wrap stat-icon-green"><UserIcon /></div>
          {loading ? <div className="spin" /> : <div className="stat-val">{stats.clinicians}</div>}
          <div className="stat-lbl">Clinicians</div>
        </div>
        <div className="stat">
          <div className="stat-icon-wrap stat-icon-yellow"><CalendarIcon /></div>
          {loading ? <div className="spin" /> : <div className="stat-val">{stats.todayCount}</div>}
          <div className="stat-lbl">Appointments Today</div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Upcoming Appointments</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/appointments')}>View all</button>
        </div>

        {loading ? (
          <div className="loading-box"><div className="spin spin-lg" /></div>
        ) : upcoming.length === 0 ? (
          <div className="empty">
            <CalendarIcon />
            <p>No upcoming appointments today</p>
          </div>
        ) : (
          upcoming.map(a => (
            <div key={a.id} className="recent-row">
              <div>
                <div className="recent-name">{a.patient_detail.name}</div>
                <div className="recent-time">{formatDateTime(a.scheduled_at)} · {formatDuration(a.duration_minutes)}</div>
              </div>
              <div className="recent-right">
                <GenderBadge gender={a.patient_detail.gender} />
                <StatusBadge status={a.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}
