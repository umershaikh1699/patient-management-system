import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HomeIcon, UsersIcon, UserIcon, CalendarIcon, CogIcon, LogOutIcon, CrossIcon } from './Icons'
import type { ReactNode } from 'react'

const NAV = [
  { to: '/',             label: 'Dashboard',   Icon: HomeIcon,     end: true },
  { to: '/patients',     label: 'Patients',     Icon: UsersIcon },
  { to: '/clinicians',   label: 'Clinicians',   Icon: UserIcon },
  { to: '/appointments', label: 'Appointments', Icon: CalendarIcon },
]

export default function Layout({ children, title }: { children: ReactNode; title: string }) {
  const { clinic, logout } = useAuth()

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon"><CrossIcon /></div>
          <span className="sidebar-brand-name">PatientHub</span>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-label">Menu</span>
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <CogIcon />
            Settings
          </NavLink>
          <button className="nav-item" onClick={logout}>
            <LogOutIcon />
            Logout
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <span className="topbar-clinic">· {clinic?.name}</span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
