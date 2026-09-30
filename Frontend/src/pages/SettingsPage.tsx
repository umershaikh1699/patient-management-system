import { useState, type FormEvent } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/api'
import { extractErrors } from '../types'

export default function SettingsPage() {
  const { clinic, setClinic } = useAuth()

  const [profile, setProfile] = useState({ name: clinic?.name ?? '', email: clinic?.email ?? '' })
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileOk, setProfileOk] = useState(false)

  const [pwd, setPwd] = useState({ current_password: '', new_password: '' })
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({})
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdOk, setPwdOk] = useState(false)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setProfileErrors({})
    setProfileOk(false)
    setProfileSaving(true)
    try {
      const { data } = await authApi.updateMe(profile)
      setClinic(data)
      setProfileOk(true)
    } catch (err) {
      setProfileErrors(extractErrors(err))
    } finally {
      setProfileSaving(false)
    }
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwdErrors({})
    setPwdOk(false)
    setPwdSaving(true)
    try {
      await authApi.changePassword(pwd)
      setPwd({ current_password: '', new_password: '' })
      setPwdOk(true)
    } catch (err) {
      setPwdErrors(extractErrors(err))
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <Layout title="Settings">
      <div className="page-hd">
        <div className="page-hd-left">
          <h1>Settings</h1>
          <p>Manage your clinic profile and security.</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Profile */}
        <div className="card card-body">
          <div className="settings-card-title">Clinic Profile</div>
          {profileErrors.non_field_errors && <div className="fapi-err">{profileErrors.non_field_errors}</div>}
          {profileOk && <div style={{ background: 'var(--success-light)', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--success)', marginBottom: 14 }}>Profile updated successfully.</div>}
          <form onSubmit={saveProfile}>
            <div className="fg" style={{ marginBottom: 13 }}>
              <label>Clinic Name</label>
              <input className={`fi ${profileErrors.name ? 'err' : ''}`} type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required />
              {profileErrors.name && <span className="fe">{profileErrors.name}</span>}
            </div>
            <div className="fg" style={{ marginBottom: 16 }}>
              <label>Email</label>
              <input className={`fi ${profileErrors.email ? 'err' : ''}`} type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} required />
              {profileErrors.email && <span className="fe">{profileErrors.email}</span>}
            </div>
            <button className="btn btn-primary" type="submit" disabled={profileSaving}>
              {profileSaving ? <><span className="spin" /> Saving…</> : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="card card-body">
          <div className="settings-card-title">Change Password</div>
          {pwdErrors.non_field_errors && <div className="fapi-err">{pwdErrors.non_field_errors}</div>}
          {pwdErrors.detail && <div className="fapi-err">{pwdErrors.detail}</div>}
          {pwdOk && <div style={{ background: 'var(--success-light)', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--success)', marginBottom: 14 }}>Password changed successfully.</div>}
          <form onSubmit={savePassword}>
            <div className="fg" style={{ marginBottom: 13 }}>
              <label>Current Password</label>
              <input className={`fi ${pwdErrors.current_password ? 'err' : ''}`} type="password" value={pwd.current_password} onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))} required />
              {pwdErrors.current_password && <span className="fe">{pwdErrors.current_password}</span>}
            </div>
            <div className="fg" style={{ marginBottom: 16 }}>
              <label>New Password</label>
              <input className={`fi ${pwdErrors.new_password ? 'err' : ''}`} type="password" placeholder="Min. 8 characters" value={pwd.new_password} onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))} required />
              {pwdErrors.new_password && <span className="fe">{pwdErrors.new_password}</span>}
            </div>
            <button className="btn btn-primary" type="submit" disabled={pwdSaving}>
              {pwdSaving ? <><span className="spin" /> Updating…</> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
