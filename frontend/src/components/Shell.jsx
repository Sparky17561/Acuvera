import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
const NAV = {
    nurse: [
        { path: '/nurse/queue', icon: '🚨', label: 'ED Queue' },
    ],
    doctor: [
        { path: '/doctor/my-cases', icon: '📂', label: 'My Cases' },
        { path: '/doctor/assignments', icon: '📬', label: 'Assignments' },
    ],
    admin: [
        { path: '/admin/overview', icon: '📊', label: 'Overview' },
        { path: '/admin/starvation', icon: '⚠️', label: 'Starvation Alerts' },
        { path: '/admin/forecast', icon: '📈', label: 'Forecast' },
        { path: '/admin/config', icon: '⚙️', label: 'Config' },
        { path: '/admin/staff', icon: '👨‍⚕️', label: 'Staff' },
    ],
    dept_head: [
        { path: '/admin/overview', icon: '📊', label: 'Overview' },
        { path: '/admin/forecast', icon: '📈', label: 'Forecast' },
    ],
}

export default function Shell({ children }) {
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const location = useLocation()
    const navItems = NAV[user?.role] || []

    const handleLogout = async () => {
        logout() // Clears zustand & localstorage, navigates to /login
    }

    return (
        <div className="shell">
            <aside className="sidebar">
                <div className="sidebar-logo">⚕ Acuvera</div>
                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <button
                            key={item.path}
                            className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="sidebar-bottom">
                    <div className="user-chip">
                        <span>👤</span>
                        <div>
                            <strong>{user?.full_name || user?.email || 'User'}</strong>
                            <div style={{ fontSize: '0.7rem', textTransform: 'capitalize', marginTop: '1px' }}>{user?.role}</div>
                        </div>
                    </div>
                    <button className="nav-item" style={{ marginTop: '0.25rem', color: 'var(--danger)' }} onClick={handleLogout}>
                        <span>🚪</span><span>Sign Out</span>
                    </button>
                </div>
            </aside>
            <main className="main">{children}</main>
        </div>
    )
}
