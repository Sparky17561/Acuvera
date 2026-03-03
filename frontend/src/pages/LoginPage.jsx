import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AuthAPI } from '../api/client'

export default function LoginPage() {
    const { setToken, fetchUser, isLoading, user } = useAuthStore()
    const [mode, setMode] = useState('doctor')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    if (user) {
        return <Navigate to="/" replace />
    }

    const handleStaffLogin = async (e) => {
        e.preventDefault()
        if (!username.trim() || !password.trim()) { setError('Enter username and password'); return }
        setError('')
        try {
            const { token } = await AuthAPI.login({ username: username.trim(), password })
            setToken(token)
            await fetchUser()
        } catch (err) {
            setError(err.response?.data?.errors?.[0] || 'Invalid credentials')
        }
    }

    return (
        <div style={{
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)',
        }}>
            <div style={{ width: 'min(480px,95vw)' }}>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-1px' }}>
                        ⚕ Acuvera
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        Emergency Department Intelligence
                    </div>
                </div>

                {/* Mode tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <button className={`btn ${mode === 'doctor' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, padding: '0.5rem' }} onClick={() => setMode('doctor')}>👨‍⚕️ Doctor</button>
                    <button className={`btn ${mode === 'nurse' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, padding: '0.5rem' }} onClick={() => setMode('nurse')}>👩‍⚕️ Nurse</button>
                    <button className={`btn ${mode === 'admin' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, padding: '0.5rem' }} onClick={() => setMode('admin')}>⚙️ Admin</button>
                </div>

                {/* ── Local Login ── */}
                <div className="card">
                    <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--primary)' }}>
                        {mode === 'doctor' ? 'Doctor Login' : mode === 'nurse' ? 'Nurse Login' : 'Admin Login'}
                    </div>
                    <form onSubmit={handleStaffLogin}>
                        <div className="form-group">
                            <label>Login ID (Username)</label>
                            <input
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter your assigned ID"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter password"
                            />
                        </div>
                        {error && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</div>
                        )}
                        <button className="btn btn-primary" style={{ width: '100%' }} type="submit" disabled={isLoading}>
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                    Acuvera v0.1 MVP — India-optimized ED Platform
                </p>
            </div>
        </div>
    )
}
