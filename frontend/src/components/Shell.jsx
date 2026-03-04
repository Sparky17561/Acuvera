import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
    LayoutDashboard, ClipboardList, Siren, BarChart2, AlertTriangle,
    TrendingUp, Settings, Users, LogOut, Activity, Stethoscope,
    ChevronRight
} from 'lucide-react'

const NAV = {
    nurse: [
        { path: '/nurse/queue', icon: Siren, label: 'ED Queue', color: 'text-rose-400' },
    ],
    doctor: [
        { path: '/doctor/my-cases', icon: LayoutDashboard, label: 'My Cases', color: 'text-blue-400' },
        { path: '/doctor/assignments', icon: ClipboardList, label: 'Assignments', color: 'text-indigo-400' },
    ],
    admin: [
        { path: '/admin/overview', icon: BarChart2, label: 'Overview', color: 'text-blue-400' },
        { path: '/admin/starvation', icon: AlertTriangle, label: 'Starvation', color: 'text-amber-400' },
        { path: '/admin/forecast', icon: TrendingUp, label: 'Forecast', color: 'text-emerald-400' },
        { path: '/admin/config', icon: Settings, label: 'Config', color: 'text-slate-400' },
        { path: '/admin/staff', icon: Users, label: 'Staff', color: 'text-indigo-400' },
    ],
    dept_head: [
        { path: '/admin/overview', icon: BarChart2, label: 'Overview', color: 'text-blue-400' },
        { path: '/admin/forecast', icon: TrendingUp, label: 'Forecast', color: 'text-emerald-400' },
    ],
}

const ROLE_CONFIG = {
    nurse: { label: 'Registered Nurse', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: Stethoscope },
    doctor: { label: 'Physician', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Activity },
    admin: { label: 'Administrator', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: Settings },
    dept_head: { label: 'Department Head', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: BarChart2 },
}

export default function Shell({ children }) {
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const location = useLocation()
    const navItems = NAV[user?.role] || []
    const roleConf = ROLE_CONFIG[user?.role] || ROLE_CONFIG.admin
    const RoleIcon = roleConf.icon

    const handleLogout = async () => {
        logout()
    }

    return (
        <div className="shell">
            <aside style={{
                width: 240,
                minHeight: '100vh',
                background: 'rgba(10, 14, 26, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(51,65,85,0.4)',
                display: 'flex',
                flexDirection: 'column',
                padding: '0',
                position: 'fixed',
                top: 0, left: 0, bottom: 0,
                zIndex: 50,
            }}>
                {/* Logo */}
                <div style={{
                    padding: '1.5rem 1.25rem 1rem',
                    borderBottom: '1px solid rgba(51,65,85,0.3)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: 38, height: 38,
                            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                            borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.1rem',
                            boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                        }}>⚕</div>
                        <div>
                            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', letterSpacing: '-0.03em' }}>
                                Acuvera
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'rgba(148,163,184,0.7)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                Clinical Suite
                            </div>
                        </div>
                    </div>
                </div>

                {/* Nav section label */}
                <div style={{ padding: '1.25rem 1.25rem 0.5rem' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(100,116,139,0.9)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                        Navigation
                    </span>
                </div>

                {/* Nav Items */}
                <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {navItems.map(item => {
                        const isActive = location.pathname.startsWith(item.path)
                        const Icon = item.icon
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.65rem 0.9rem',
                                    borderRadius: 10,
                                    border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                                    background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                                    color: isActive ? '#fff' : 'rgba(148,163,184,0.8)',
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    textAlign: 'left',
                                    width: '100%',
                                    position: 'relative',
                                }}
                                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(30,41,59,0.6)'; e.currentTarget.style.color = '#fff' } }}
                                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(148,163,184,0.8)' } }}
                            >
                                {/* Active indicator stripe */}
                                {isActive && (
                                    <span style={{
                                        position: 'absolute', left: 0, top: '25%', bottom: '25%',
                                        width: 3, borderRadius: '0 3px 3px 0',
                                        background: 'linear-gradient(to bottom, #3b82f6, #6366f1)',
                                    }} />
                                )}
                                <span style={{ marginLeft: isActive ? 4 : 0 }}>
                                    <Icon size={16} className={isActive ? 'text-blue-400' : ''} style={{ color: isActive ? '#60a5fa' : 'inherit', flexShrink: 0 }} />
                                </span>
                                <span style={{ flex: 1 }}>{item.label}</span>
                                {isActive && <ChevronRight size={12} style={{ color: 'rgba(96,165,250,0.6)', flexShrink: 0 }} />}
                            </button>
                        )
                    })}
                </nav>

                {/* Bottom: User + Sign Out */}
                <div style={{
                    padding: '1rem 0.75rem',
                    borderTop: '1px solid rgba(51,65,85,0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                }}>
                    {/* User chip */}
                    <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 12,
                        background: roleConf.bg,
                        border: `1px solid ${roleConf.border.replace('border-', '')}`,
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                    }}>
                        <div style={{
                            width: 34, height: 34,
                            borderRadius: 10,
                            background: 'rgba(30,41,59,0.6)',
                            border: '1px solid rgba(51,65,85,0.6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <RoleIcon size={15} style={{ color: '#60a5fa' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user?.full_name || user?.email || 'User'}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.7)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 1 }}>
                                {roleConf.label}
                            </div>
                        </div>
                    </div>

                    {/* Sign Out */}
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.65rem',
                            padding: '0.6rem 0.9rem',
                            borderRadius: 10,
                            border: '1px solid transparent',
                            background: 'transparent',
                            color: 'rgba(148,163,184,0.6)',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            width: '100%',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)'; e.currentTarget.style.borderColor = 'transparent' }}
                    >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>
            <main className="main" style={{ marginLeft: 240 }}>{children}</main>
        </div>
    )
}
