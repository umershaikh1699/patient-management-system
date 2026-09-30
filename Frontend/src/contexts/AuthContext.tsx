import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Clinic } from '../types'
import { authApi } from '../services/api'

interface AuthCtx {
  isAuthenticated: boolean
  clinic: Clinic | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setClinic: (c: Clinic) => void
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { setLoading(false); return }
    authApi.me()
      .then(({ data }) => setClinic(data))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    setClinic(data.clinic)
  }

  const logout = () => {
    localStorage.clear()
    setClinic(null)
    window.location.href = '/login'
  }

  return (
    <Ctx.Provider value={{ isAuthenticated: !!clinic, clinic, loading, login, logout, setClinic }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
