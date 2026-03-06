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
        console.log("[LoginPage] Attempting login for:", username)
        try {
            const { token } = await AuthAPI.login({ username: username.trim(), password })
            console.log("[LoginPage] Token received:", token ? "Yes" : "No")
            setToken(token)
            console.log("[LoginPage] Fetching user profile...")
            await fetchUser()
            console.log("[LoginPage] Done fetching user, current local state")
        } catch (err) {
            console.error("[LoginPage] Login failed, error:", err)
            console.error("[LoginPage] Error response:", err.response?.data)
            setError(err.response?.data?.errors?.[0] || 'Invalid credentials')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans select-none">
            {/* Background decorative elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]" />

            <div className="w-full max-w-md p-6 relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-8 transform transition-all duration-700">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-2xl mb-4 border border-blue-500/30 backdrop-blur-xl group">
                        <span className="text-3xl animate-pulse">⚕</span>
                    </div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent tracking-tighter">
                        Acuvera
                    </h1>
                    <p className="text-slate-400 text-sm font-medium mt-1 tracking-wide uppercase opacity-80">
                        Emergency Department Intelligence
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl shadow-blue-500/10">
                    {/* Role Selection Tabs */}
                    <div className="flex p-1 bg-slate-800/50 rounded-xl mb-8 border border-slate-700/30">
                        {['doctor', 'nurse', 'admin'].map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 capitalize ${mode === m
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-500/50'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                {m === 'doctor' ? '👨‍⚕️' : m === 'nurse' ? '👩‍⚕️' : '⚙️'} {m}
                            </button>
                        ))}
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                            {mode.charAt(0).toUpperCase() + mode.slice(1)} Portal
                        </h2>
                        <p className="text-slate-400 text-xs mt-1">Access secure clinical workspace</p>
                    </div>

                    <form onSubmit={handleStaffLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                                Clinical ID
                            </label>
                            <input
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all duration-200"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter assigned username"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                                Secure Key
                            </label>
                            <input
                                type="password"
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all duration-200"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2 animate-shake">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <button
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : 'Authorize Access'}
                        </button>
                    </form>
                </div>

                {/* Footer Info */}
                <div className="mt-8 space-y-4 text-center">
                    <p className="text-slate-500 text-[10px] items-center justify-center gap-2 uppercase tracking-[0.2em] font-bold">
                        Acuvera <span className="text-blue-500 font-extrabold items-center">v0.1</span> • India Optimized • PWA Ready
                    </p>

                    <div className="p-4 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-sm">
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                            <span className="text-amber-500/80 font-bold block mb-1 uppercase tracking-wider">
                                ⚠️ Clinical Decision Support Disclaimer
                            </span>
                            Acuvera triage prioritization is a digital tool to assist staff.
                            Diagnostic responsibility remains with qualified healthcare professionals.
                            Privacy-first: No sensitive PHI is processed by external AI.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
