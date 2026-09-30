import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/api'
import { extractErrors } from '../types'
import { CrossIcon } from '../components/Icons'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [form, setForm] = useState({ email: '', password: '', confirm_password: '', name: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setErrors(extractErrors(err))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (form.password !== form.confirm_password) {
      setErrors({ confirm_password: 'Passwords do not match.' })
      return
    }
    setLoading(true)
    try {
      await authApi.register({ email: form.email, password: form.password, name: form.name })
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setErrors(extractErrors(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon"><CrossIcon /></div>
          <span className="login-brand-name">PatientHub</span>
        </div>

        <h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        <p>{mode === 'login' ? 'Sign in to your clinic account' : 'Register your clinic to get started'}</p>

        {errors.non_field_errors && (
          <div className="fapi-err" style={{ marginBottom: 14 }}>{errors.non_field_errors}</div>
        )}
        {errors.detail && (
          <div className="fapi-err" style={{ marginBottom: 14 }}>{errors.detail}</div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
          {mode === 'register' && (
            <div className="fg">
              <label>Clinic Name</label>
              <input className={`fi ${errors.name ? 'err' : ''}`} type="text" placeholder="e.g. City Medical Clinic" value={form.name} onChange={set('name')} required />
              {errors.name && <span className="fe">{errors.name}</span>}
            </div>
          )}
          <div className="fg">
            <label>Email</label>
            <input className={`fi ${errors.email ? 'err' : ''}`} type="email" placeholder="clinic@example.com" value={form.email} onChange={set('email')} required />
            {errors.email && <span className="fe">{errors.email}</span>}
          </div>
          <div className="fg" style={{ marginTop: 12 }}>
            <label>Password</label>
            <input className={`fi ${errors.password ? 'err' : ''}`} type="password" placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'} value={form.password} onChange={set('password')} required />
            {errors.password && <span className="fe">{errors.password}</span>}
          </div>
          {mode === 'register' && (
            <div className="fg" style={{ marginTop: 12 }}>
              <label>Confirm Password</label>
              <input className={`fi ${errors.confirm_password ? 'err' : ''}`} type="password" placeholder="Repeat password" value={form.confirm_password} onChange={set('confirm_password')} required />
              {errors.confirm_password && <span className="fe">{errors.confirm_password}</span>}
            </div>
          )}
          <button className="btn btn-primary login-btn" type="submit" disabled={loading} style={{ marginTop: 18 }}>
            {loading ? <span className="spin" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button onClick={() => { setMode('register'); setErrors({}); setForm(f => ({ ...f, confirm_password: '' })) }}>Register clinic</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setErrors({}); setForm(f => ({ ...f, confirm_password: '' })) }}>Sign in</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
