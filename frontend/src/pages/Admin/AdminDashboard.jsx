import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, LineChart, Line, Legend
} from 'recharts'
import Shell from '../../components/Shell'
import { AdminAPI, AuthAPI, SimulateAPI } from '../../api/client'

// ─── Overview Page ────────────────────────────────────────────
function OverviewPage() {
    const [data, setData] = useState(null)
    const [alerts, setAlerts] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        try {
            const [overview, starvation] = await Promise.all([
                AdminAPI.overview(),
                AdminAPI.starvationAlerts(),
            ])
            setData(overview)
            setAlerts(Array.isArray(starvation) ? starvation : [])
        } catch { }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm font-medium tracking-widest uppercase">Analyzing Operations...</span>
        </div>
    )

    const priority_dist = data?.priority_distribution || { critical: 0, high: 0, moderate: 0, low: 0 }
    const priorityChartData = Object.entries(priority_dist).map(([name, value]) => ({ name, value }))
    const COLOR_MAP = { critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e' }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/50">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">📊</span>
                        Operations Overview
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Live system status — auto-refreshes every 60s
                    </p>
                </div>
                <button
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-all active:scale-95 shadow-lg shadow-black/20"
                    onClick={load}
                >
                    <span className="text-blue-400">↻</span> Refresh Metrics
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Active Patients', value: data?.active_patients ?? 0, icon: '🧑‍⚕️', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
                    { label: 'Avg Wait', value: data?.avg_wait_time_seconds ? `${Math.floor(data.avg_wait_time_seconds / 60)}m` : '—', icon: '⏱', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
                    { label: 'Starving', value: data?.starvation_count ?? 0, icon: '⚠️', color: data?.starvation_count > 0 ? 'text-rose-400' : 'text-emerald-400', bg: data?.starvation_count > 0 ? 'bg-rose-400/10' : 'bg-emerald-400/10', border: data?.starvation_count > 0 ? 'border-rose-400/20' : 'border-emerald-400/20' },
                    { label: 'Overloaded Drs', value: data?.overloaded_doctors ?? 0, icon: '🏥', color: data?.overloaded_doctors > 0 ? 'text-rose-400' : 'text-emerald-400', bg: data?.overloaded_doctors > 0 ? 'bg-rose-400/10' : 'bg-emerald-400/10', border: data?.overloaded_doctors > 0 ? 'border-rose-400/20' : 'border-emerald-400/20' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl shadow-black/5 hover:border-slate-600/50 transition-all group">
                        <div className="flex items-center gap-3 mb-4">
                            <span className={`p-2 rounded-lg ${s.bg} ${s.border} text-lg group-hover:scale-110 transition-transform`}>{s.icon}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{s.label}</span>
                        </div>
                        <div className={`text-4xl font-black ${s.color} tracking-tighter`}>{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Priority Distribution */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl shadow-black/5 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 border-l-2 border-blue-500">
                            Priority Distribution
                        </h3>
                    </div>
                    <div className="flex-1 min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priorityChartData} barCategoryGap="25%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                    className="uppercase tracking-tighter"
                                />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderRadius: '12px',
                                        border: '1px solid #334155',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                                        fontSize: '12px'
                                    }}
                                />
                                <Bar
                                    dataKey="value"
                                    radius={[6, 6, 0, 0]}
                                    isAnimationActive={true}
                                    animationDuration={1000}
                                    animationEasing="ease-out"
                                >
                                    {priorityChartData.map((entry, index) => (
                                        <Bar
                                            key={`cell-${index}`}
                                            fill={COLOR_MAP[entry.name] || '#3b82f6'}
                                            opacity={0.8}
                                            className="hover:opacity-100 transition-opacity"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Starvation alerts */}
                <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl shadow-black/5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 border-l-2 border-rose-500">
                            🚨 Critical Starvation Alerts
                        </h3>
                        {alerts.length > 0 && (
                            <span className="px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                {alerts.length} Flagged
                            </span>
                        )}
                    </div>

                    {alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <div className="text-4xl mb-4 bg-emerald-500/10 p-4 rounded-full text-emerald-500">✅</div>
                            <p className="font-bold text-sm">All operations within SLA thresholds</p>
                            <p className="text-xs uppercase tracking-widest mt-1 opacity-60">No starving encounters detected</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {alerts.map(enc => (
                                <div key={enc.id} className="group bg-slate-950/40 border border-slate-800/50 rounded-xl p-4 flex items-center gap-4 hover:border-slate-700 hover:bg-slate-900/50 transition-all cursor-default">
                                    <div className={`w-2 h-12 rounded-full bg-${enc.priority === 'critical' ? 'rose' : enc.priority === 'high' ? 'orange' : 'amber'}-500 shrink-0 shadow-lg shadow-black/20`} />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-sm font-bold text-white leading-none tracking-tight">{enc.patient_detail?.name || 'Patient'}</span>
                                            <span className="text-[10px] font-black uppercase text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-400/20">{enc.wait_minutes}m</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{enc.priority}</span>
                                            <span className="w-1 h-1 bg-slate-700 rounded-full" />
                                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">Overdue by {enc.wait_minutes - (enc.threshold_minutes || 60)}m</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Forecast Page ────────────────────────────────────────────
function ForecastPage() {
    const [depts, setDepts] = useState([])
    const [selectedDept, setSelectedDept] = useState('')
    const [forecast, setForecast] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        AdminAPI.departments().then(d => {
            setDepts(Array.isArray(d) ? d : [])
            if (d?.[0]) setSelectedDept(d[0].id)
        }).catch(() => { })
    }, [])

    useEffect(() => {
        if (!selectedDept) return
        setLoading(true)
        AdminAPI.forecast({ department: selectedDept })
            .then(setForecast)
            .catch(() => setForecast(null))
            .finally(() => setLoading(false))
    }, [selectedDept])

    const chartData = forecast
        ? Object.entries(forecast.hourly_forecast || {}).map(([hour, f]) => ({
            hour: `${hour}:00`,
            expected: f.expected,
            low: f.low,
            high: f.high,
        }))
        : []

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">📈</span>
                        Peak Hour Forecast
                    </h1>
                    <p className="text-slate-400 text-sm mt-1.5 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Exponential smoothing model · 90-day historical baseline
                    </p>
                </div>

                {/* Department Selector */}
                <div className="relative">
                    <select
                        value={selectedDept}
                        onChange={e => setSelectedDept(e.target.value)}
                        className="appearance-none pl-4 pr-10 py-2.5 bg-slate-900/70 border border-slate-700 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 cursor-pointer backdrop-blur-sm transition-all"
                        style={{ width: 'auto', minWidth: 200 }}
                    >
                        {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">▾</div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-72 gap-4 text-slate-400">
                    <div className="w-10 h-10 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-sm font-medium tracking-widest uppercase">Computing forecast...</span>
                </div>
            ) : !forecast ? (
                <div className="flex flex-col items-center justify-center py-24 bg-slate-900/30 rounded-3xl border border-dashed border-slate-700/50">
                    <div className="text-5xl mb-4 opacity-20">📊</div>
                    <p className="text-slate-500 font-medium">No forecast data yet</p>
                    <p className="text-slate-600 text-sm mt-1">Requires 90+ days of patient history</p>
                </div>
            ) : (
                <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {[
                            {
                                label: 'Peak Hour',
                                value: `${forecast.peak_hour}:00`,
                                sub: `${forecast.peak_expected_count} expected arrivals`,
                                icon: '⏰',
                                color: 'text-blue-400',
                                bg: 'bg-blue-400/10',
                                border: 'border-blue-400/20'
                            },
                            {
                                label: 'Recommended Doctors',
                                value: forecast.staffing_suggestion?.recommended_doctors,
                                sub: `Target wait: ${forecast.staffing_suggestion?.target_avg_wait_minutes} min`,
                                icon: '🧑‍⚕️',
                                color: 'text-emerald-400',
                                bg: 'bg-emerald-400/10',
                                border: 'border-emerald-400/20'
                            },
                        ].map(s => (
                            <div key={s.label} className={`bg-slate-900/50 backdrop-blur-xl border ${s.border} rounded-2xl p-6 shadow-xl shadow-black/5 flex items-center gap-5`}>
                                <div className={`p-3 rounded-2xl ${s.bg} border ${s.border} text-2xl`}>{s.icon}</div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{s.label}</div>
                                    <div className={`text-4xl font-black ${s.color} tracking-tighter`}>{s.value}</div>
                                    <div className="text-xs text-slate-500 mt-1 font-medium">{s.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chart Card */}
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl shadow-black/5">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 border-l-2 border-emerald-500">
                                    Hourly Arrival Forecast
                                </h3>
                                <p className="text-slate-600 text-xs mt-1 font-medium">Projected over the next 7 days</p>
                            </div>
                            <div className="flex items-center gap-5 text-xs font-semibold text-slate-500">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400 rounded-full inline-block" /> Expected</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-400 rounded-full inline-block" /> High</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 rounded-full inline-block" /> Low</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="gradExpected" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis
                                    dataKey="hour"
                                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={2}
                                />
                                <YAxis
                                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(51,65,85,0.8)',
                                        borderRadius: 12,
                                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                    }}
                                    labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                                />
                                <Legend wrapperStyle={{ display: 'none' }} />
                                <Area type="monotone" dataKey="expected" stroke="#3b82f6" fill="url(#gradExpected)" strokeWidth={2.5} name="Expected" dot={false} />
                                <Area type="monotone" dataKey="high" stroke="#f97316" fill="url(#gradHigh)" strokeDasharray="5 3" strokeWidth={1.5} name="High estimate" dot={false} />
                                <Area type="monotone" dataKey="low" stroke="#22c55e" fill="none" strokeDasharray="5 3" strokeWidth={1.5} name="Low estimate" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Config Page ──────────────────────────────────────────────
function ConfigPage() {
    const [config, setConfig] = useState(null)
    const [departments, setDepartments] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState(null)

    // Dept Form State
    const [deptForm, setDeptForm] = useState({ name: '', starvation_threshold_minutes: 60, profile_type: 'general' })
    const [editingDeptId, setEditingDeptId] = useState(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [c, d] = await Promise.all([AdminAPI.config(), AdminAPI.departments()])
            setConfig(c || {})
            setDepartments(Array.isArray(d) ? d : [])
        } catch { }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const saveConfig = async () => {
        setSaving(true)
        try {
            await AdminAPI.updateConfig(config)
            setMsg({ type: 'success', text: 'Hospital configuration saved successfully.' })
        } catch (err) {
            setMsg({ type: 'danger', text: 'Failed to save: ' + (err.response?.data?.errors || err.message) })
        } finally { setSaving(false); setTimeout(() => setMsg(null), 3000) }
    }

    const handleDeptSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingDeptId) {
                await AdminAPI.updateDepartment(editingDeptId, deptForm)
                setMsg({ type: 'success', text: 'Department updated.' })
            } else {
                await AdminAPI.createDepartment(deptForm)
                setMsg({ type: 'success', text: 'New department added.' })
            }
            setDeptForm({ name: '', starvation_threshold_minutes: 60, profile_type: 'general' })
            setEditingDeptId(null)
            loadData()
        } catch (err) {
            setMsg({ type: 'danger', text: 'Operation failed: ' + (err.response?.data?.errors || err.message) })
        } finally { setTimeout(() => setMsg(null), 3000) }
    }

    const toggleDeptStatus = async (id) => {
        try {
            await AdminAPI.deleteDepartment(id)
            loadData()
        } catch (err) {
            setMsg({ type: 'danger', text: 'Failed to update department status.' })
        }
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm font-medium tracking-widest uppercase italic opacity-80">Loading secure config...</span>
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/50">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">⚙️</span>
                        Hospital Control
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Configure clinical thresholds and manage departments</p>
                </div>
                {msg && (
                    <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border animate-in zoom-in-95 duration-300 ${msg.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                        {msg.text}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Hospital Config */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
                            Global Configuration
                        </h2>
                        <button
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                            onClick={saveConfig}
                            disabled={saving}
                        >
                            {saving ? 'Processing...' : 'Save All Changes'}
                        </button>
                    </div>

                    {config ? (
                        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-6 shadow-xl shadow-black/5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Hospital Name</label>
                                <input
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-700"
                                    value={config.hospital_name || ''}
                                    onChange={e => setConfig(c => ({ ...c, hospital_name: e.target.value }))}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Cases / Doctor</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                        value={config.max_active_cases_per_doctor || 6}
                                        onChange={e => setConfig(c => ({ ...c, max_active_cases_per_doctor: parseInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Avg Revenue (₹)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                        value={config.avg_revenue_per_patient || 500}
                                        onChange={e => setConfig(c => ({ ...c, avg_revenue_per_patient: parseFloat(e.target.value) }))}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 space-y-4">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">SLA Thresholds (Seconds)</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        ['sla_code_blue_seconds', 'Code Blue'],
                                        ['sla_trauma_seconds', 'Trauma'],
                                        ['sla_manual_seconds', 'Manual']
                                    ].map(([k, lbl]) => (
                                        <div className="space-y-2" key={k}>
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter pl-1">{lbl}</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                                value={config[k] || ''}
                                                onChange={e => setConfig(c => ({ ...c, [k]: parseInt(e.target.value) }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 space-y-3">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Operational Feature Flags</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.keys(config.feature_flags || {}).sort().map(flag => (
                                        <div key={flag} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/30 border border-slate-800/50 hover:border-slate-700 transition-colors group">
                                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors capitalize">{flag.replace(/_/g, ' ')}</span>
                                            <button
                                                className={`px-3 py-1 text-[10px] font-black rounded-lg active:scale-90 border transition-all duration-300 ${config.feature_flags[flag]
                                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                                    : 'bg-slate-800/50 border-slate-700 text-slate-500'
                                                    }`}
                                                onClick={() => setConfig(c => ({ ...c, feature_flags: { ...c.feature_flags, [flag]: !c.feature_flags[flag] } }))}>
                                                {config.feature_flags[flag] ? 'ENABLED' : 'DISABLED'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 italic">
                            System configuration sync failed...
                        </div>
                    )}
                </div>

                {/* Departments Section */}
                <div className="space-y-6">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                        Clinical Departments
                    </h2>

                    {/* Add/Edit Form */}
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl shadow-black/5">
                        <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                            {editingDeptId ? (
                                <><span className="text-blue-400 font-black">EDIT</span> Modifying {deptForm.name}</>
                            ) : (
                                <><span className="text-emerald-400 font-black">NEW</span> Register Department</>
                            )}
                        </h3>
                        <form onSubmit={handleDeptSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Department Name</label>
                                <input
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-slate-800"
                                    value={deptForm.name}
                                    onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                                    required
                                    placeholder="e.g. Intensive Care Unit"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Starve Threshold (m)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                                        value={deptForm.starvation_threshold_minutes}
                                        onChange={e => setDeptForm({ ...deptForm, starvation_threshold_minutes: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Clinical Profile</label>
                                    <select
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                                        value={deptForm.profile_type}
                                        onChange={e => setDeptForm({ ...deptForm, profile_type: e.target.value })}
                                    >
                                        <option value="general">General Ward</option>
                                        <option value="emergency">Emergency Response</option>
                                        <option value="critical_care">Critical Care</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95">
                                    {editingDeptId ? 'Update Identity' : 'Commission Department'}
                                </button>
                                {editingDeptId && (
                                    <button
                                        type="button"
                                        className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all active:scale-95"
                                        onClick={() => { setEditingDeptId(null); setDeptForm({ name: '', starvation_threshold_minutes: 60, profile_type: 'general' }) }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Department List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Active Units</h3>
                            <span className="text-[10px] font-bold text-slate-700">{departments.length} Units</span>
                        </div>
                        {departments.length === 0 ? (
                            <p className="text-center py-6 text-xs text-slate-500 italic uppercase tracking-widest opacity-50 bg-slate-900/20 rounded-2xl border border-slate-800/30">
                                No clinical units operational
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {departments.map(d => (
                                    <div key={d.id} className="group flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-slate-800/50 hover:border-slate-700/80 hover:bg-slate-900/60 transition-all shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1 h-8 rounded-full ${d.profile_type === 'critical_care' ? 'bg-rose-500' : d.profile_type === 'emergency' ? 'bg-amber-500' : 'bg-blue-500'
                                                }`} />
                                            <div>
                                                <div className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{d.name}</div>
                                                <div className="text-[10px] font-medium text-slate-500 flex items-center gap-2 uppercase tracking-tight">
                                                    SLA: {d.starvation_threshold_minutes}m
                                                    <span className="w-1 h-1 bg-slate-800 rounded-full" />
                                                    {d.profile_type.replace(/_/g, ' ')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                                title="Edit Department"
                                                onClick={() => { setEditingDeptId(d.id); setDeptForm({ name: d.name, starvation_threshold_minutes: d.starvation_threshold_minutes, profile_type: d.profile_type }) }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                                                title="Decommission"
                                                onClick={() => toggleDeptStatus(d.id)}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Starvation Page ──────────────────────────────────────────
function StarvationPage() {
    const [alerts, setAlerts] = useState([])
    const [loading, setLoading] = useState(true)
    const [depts, setDepts] = useState([])
    const [dept, setDept] = useState('')

    const load = useCallback(async () => {
        try {
            const data = await AdminAPI.starvationAlerts(dept ? { department: dept } : {})
            setAlerts(Array.isArray(data) ? data : [])
        } catch { setAlerts([]) }
        finally { setLoading(false) }
    }, [dept])

    useEffect(() => {
        AdminAPI.departments().then(d => setDepts(Array.isArray(d) ? d : [])).catch(() => { })
    }, [])

    useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">⚠️ Starvation Alerts</div>
                    <div className="page-subtitle">Encounters waiting beyond department threshold</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select value={dept} onChange={e => setDept(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
                        <option value="">All Departments</option>
                        {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
                </div>
            </div>
            {loading ? <div className="loading-center"><div className="spinner" /></div> : alerts.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">✅</div><p>No starvation alerts</p></div>
            ) : (
                <div className="table-wrap card">
                    <table>
                        <thead>
                            <tr><th>Patient</th><th>Priority</th><th>Wait</th><th>Threshold</th><th>Dept</th><th>Doctor</th></tr>
                        </thead>
                        <tbody>
                            {alerts.map(enc => (
                                <tr key={enc.id} className={`row-${enc.priority}`}>
                                    <td style={{ fontWeight: 600 }}>{enc.patient_detail?.name || '—'}</td>
                                    <td><span className={`badge badge-${enc.priority}`}>{enc.priority}</span></td>
                                    <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{enc.wait_minutes}m</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{enc.threshold_minutes}m</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{enc.department}</td>
                                    <td style={{ color: enc.assigned_doctor_detail ? 'var(--text)' : 'var(--warn)' }}>
                                        {enc.assigned_doctor_detail?.full_name || '⚠ Unassigned'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ─── Staff Page ────────────────────────────────────────────────
function StaffPage() {
    const [depts, setDepts] = useState([])
    const [staffList, setStaffList] = useState([])
    const [msg, setMsg] = useState(null)
    const [loading, setLoading] = useState(false)
    const [fetchingLogs, setFetchingLogs] = useState(true)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({
        username: '',
        password: '',
        email: '',
        full_name: '',
        role: 'doctor',
        department_id: '',
    })

    const fetchStaff = useCallback(async () => {
        setFetchingLogs(true)
        try {
            const data = await AdminAPI.staffList()
            setStaffList(Array.isArray(data) ? data : [])
        } catch { }
        finally { setFetchingLogs(false) }
    }, [])

    useEffect(() => {
        AdminAPI.departments().then(d => setDepts(Array.isArray(d) ? d : [])).catch(() => { })
        fetchStaff()
    }, [fetchStaff])

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to disable this user?")) return
        try {
            await AdminAPI.deleteStaff(id)
            setMsg({ type: 'success', text: 'User account disabled successfully.' })
            if (editingId === id) cancelEdit()
            fetchStaff()
        } catch (err) {
            setMsg({ type: 'danger', text: 'Error disabling user: ' + (err.response?.data?.errors || err.message) })
        } finally { setTimeout(() => setMsg(null), 3000) }
    }

    const handleEnable = async (u) => {
        try {
            await AdminAPI.updateStaff(u.id, { is_active: true });
            setMsg({ type: 'success', text: `Authentication restored for ${u.full_name}.` });
            fetchStaff();
        } catch (err) {
            setMsg({ type: 'danger', text: 'Failed to restore account authorization.' });
        } finally { setTimeout(() => setMsg(null), 3000) }
    }

    const handleEdit = (u) => {
        setEditingId(u.id)
        setForm({
            username: u.username || u.clerk_user_id || u.id.split('-')[0],
            password: '',
            email: u.email || '',
            full_name: u.full_name || '',
            role: u.role || 'doctor',
            department_id: u.department_id || '',
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setForm({ username: '', password: '', email: '', full_name: '', role: 'doctor', department_id: '' })
        setMsg(null)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMsg(null)
        try {
            if (editingId) {
                const patchData = { ...form }
                if (!patchData.password) delete patchData.password
                await AdminAPI.updateStaff(editingId, patchData)
                setMsg({ type: 'success', text: `Identity verified for ${form.full_name}. Profile updated.` })
                cancelEdit()
            } else {
                await AuthAPI.register(form)
                setMsg({ type: 'success', text: `New medical record initialized for ${form.full_name}.` })
                setForm({ username: '', password: '', email: '', full_name: '', role: 'doctor', department_id: '' })
            }
            fetchStaff()
        } catch (err) {
            setMsg({ type: 'danger', text: 'System rejection: ' + (err.response?.data?.errors || err.message) })
        } finally {
            setLoading(false)
            setTimeout(() => setMsg(null), 4000)
        }
    }

    if (fetchingLogs && staffList.length === 0) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm font-medium tracking-widest uppercase italic opacity-80">Syncing personnel directory...</span>
        </div>
    )

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/50">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">👥</span>
                        Medical Personnel
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage hospital roles, credentials, and departmental access</p>
                </div>
                {msg && (
                    <div className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest border animate-in zoom-in-95 duration-300 shadow-lg ${msg.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/5'
                        }`}>
                        {msg.text}
                    </div>
                )}
            </div>

            {/* Top Section: Registration Form */}
            <div className="max-w-4xl mx-auto">
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-700/50 rounded-4xl p-8 shadow-2xl shadow-black/20">
                    <div className="flex items-center gap-4 mb-8">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${editingId ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'}`}>
                            {editingId ? '✍️' : '🆕'}
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">
                                {editingId ? 'Identity Calibration' : 'Personnel Induction'}
                            </h2>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                                {editingId ? `Modifying profile for UID: ${editingId.split('-')[0]}` : 'Assign initial credentials and role'}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Full Legal Name</label>
                                <input
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl px-5 py-4 text-white focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-800"
                                    value={form.full_name}
                                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                                    required
                                    placeholder="e.g. Dr. Alexander Pierce"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Operational Role</label>
                                <select
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl px-5 py-4 text-white focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all appearance-none cursor-pointer"
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="doctor">Medical Doctor</option>
                                    <option value="nurse">Clinical Nurse</option>
                                    <option value="dept_head">Department Head</option>
                                    <option value="admin">System Administrator</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">System Login ID</label>
                                <input
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl px-5 py-4 text-white focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-800"
                                    value={form.username}
                                    onChange={e => setForm({ ...form, username: e.target.value })}
                                    placeholder="e.g. apierce_md"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                    {editingId ? 'Access Reset (Secret)' : 'Initial Password'}
                                    {editingId && <span className="ml-2 text-slate-600">(Optional)</span>}
                                </label>
                                <input
                                    type="password"
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl px-5 py-4 text-white focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-800"
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    placeholder={editingId ? "Leave empty to retain" : "Temporary secure key"}
                                    required={!editingId}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Electronic Mail</label>
                                <input
                                    type="email"
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl px-5 py-4 text-white focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-800"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    required
                                    placeholder="a.pierce@hospital.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                    Assigned Unit
                                    {form.role === 'admin' && <span className="ml-2 text-slate-600">(Optional)</span>}
                                </label>
                                <select
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl px-5 py-4 text-white focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all appearance-none cursor-pointer"
                                    value={form.department_id}
                                    onChange={e => setForm({ ...form, department_id: e.target.value })}
                                    required={form.role === 'doctor' || form.role === 'nurse'}
                                >
                                    <option value="">Select unit deployment...</option>
                                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 disabled:opacity-50 ${editingId ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                                    }`}
                                disabled={loading}
                            >
                                {loading ? 'Synchronizing...' : (editingId ? 'Commit Update' : 'Authorize Personnel')}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    className="px-8 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-2xl transition-all active:scale-95 uppercase text-xs tracking-widest"
                                    onClick={cancelEdit}
                                >
                                    Abort
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            {/* Active Directory Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                        Active Personnel Database
                    </h2>
                    <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        {staffList.filter(u => u.is_active).length} Records Verified
                    </span>
                </div>

                {staffList.filter(u => u.is_active).length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-16 text-center">
                        <p className="text-slate-500 italic font-medium">Personnel directory is currently empty...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {staffList.filter(u => u.is_active).map(u => (
                            <div key={u.id} className="group bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-5 hover:border-indigo-500/30 hover:bg-slate-900/60 transition-all duration-500 flex flex-col justify-between shadow-lg hover:shadow-indigo-500/5">
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                {u.role === 'admin' ? '🛡️' : u.role === 'doctor' ? '👨‍⚕️' : '🩺'}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors leading-tight">{u.full_name}</h3>
                                                <p className="text-[10px] font-medium text-slate-500 font-mono tracking-tighter opacity-80 mt-0.5 uppercase italic">{u.username || u.clerk_user_id || u.id.split('-')[0]}</p>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                                            u.role === 'doctor' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' :
                                                'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                            }`}>
                                            {u.role.replace('_', ' ')}
                                        </div>
                                    </div>

                                    <div className="space-y-1 pl-1">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 truncate">
                                            <span>📧</span> {u.email}
                                        </div>
                                        {u.department_name && (
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-tight">
                                                <span>🏥</span> {u.department_name}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 flex gap-2">
                                    <button
                                        className="flex-1 py-2 bg-slate-800/80 hover:bg-indigo-600 hover:text-white text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-700/50 hover:border-indigo-500 active:scale-95"
                                        onClick={() => handleEdit(u)}
                                    >
                                        Edit Profile
                                    </button>
                                    <button
                                        className="px-4 py-2 bg-slate-800/80 hover:bg-rose-600/20 hover:text-rose-400 text-slate-500 text-[10px] font-black rounded-xl transition-all border border-slate-700/50 hover:border-rose-500/40 active:scale-95"
                                        title="Disable Account"
                                        onClick={() => handleDelete(u.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Disabled Section */}
            <div className="space-y-4 pt-10 opacity-70 border-t border-slate-800/50">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xs font-black text-slate-600 uppercase tracking-[0.25em] flex items-center gap-3">
                        <span className="w-1.5 h-4 bg-slate-700 rounded-full" />
                        Decommissioned Accounts
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 uppercase italic">Authorization Revoked</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {staffList.filter(u => !u.is_active).length === 0 ? (
                        <div className="col-span-full py-8 text-center bg-slate-900/10 border border-slate-800/20 rounded-3xl">
                            <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">No restricted credentials found.</p>
                        </div>
                    ) : (
                        staffList.filter(u => !u.is_active).map(u => (
                            <div key={u.id} className="group bg-slate-950/40 border border-slate-800/50 rounded-2xl p-4 flex items-center justify-between hover:border-indigo-500/20 transition-all duration-300">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-sm grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                        {u.role === 'admin' ? '🛡️' : '👤'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-400 truncate group-hover:text-slate-200 transition-colors uppercase tracking-tight">{u.full_name}</div>
                                        <div className="text-[9px] font-black text-slate-600 uppercase tracking-tighter truncate">{u.role}</div>
                                    </div>
                                </div>
                                <button
                                    className="p-2 text-[10px] font-black text-indigo-400/40 hover:text-indigo-400 uppercase border border-indigo-500/10 hover:border-indigo-500/30 rounded-xl bg-indigo-500/5 transition-all active:scale-95"
                                    onClick={() => handleEnable(u)}
                                    title="Restore Authorization"
                                >
                                    Restore
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Simulation Page ──────────────────────────────────────────
const SCENARIOS = [
    {
        id: 'cardiac_surge',
        label: '❤️ Cardiac Surge',
        desc: '30 patients flooding ER with cardiac symptoms — tachycardia, chest pain, low SpO₂',
        color: '#ef4444', border: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.08)',
    },
    {
        id: 'mass_casualty',
        label: '🚨 Mass Casualty Event',
        desc: 'Multi-trauma victims from an accident scene — head injuries, fractures, hemorrhage',
        color: '#f97316', border: 'rgba(249,115,22,0.3)', bg: 'rgba(249,115,22,0.08)',
    },
    {
        id: 'pneumonia_cluster',
        label: '🫁 Pneumonia Cluster',
        desc: 'Respiratory outbreak — low SpO₂, fever, elevated RR, vulnerable patients',
        color: '#3b82f6', border: 'rgba(59,130,246,0.3)', bg: 'rgba(59,130,246,0.08)',
    },
    {
        id: 'normal_ops',
        label: '🟢 Normal Operations',
        desc: 'Standard ER day — mix of low/moderate severity to test baseline queue handling',
        color: '#22c55e', border: 'rgba(34,197,94,0.3)', bg: 'rgba(34,197,94,0.08)',
    },
]

function SimulationPage() {
    const [scenario, setScenario] = useState('cardiac_surge')
    const [patientCount, setPatientCount] = useState(20)
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [animCount, setAnimCount] = useState(0)

    const runSim = async () => {
        setRunning(true); setResult(null); setError(null); setAnimCount(0)
        try {
            const data = await SimulateAPI.run({ scenario, patient_count: patientCount })
            // Animate counter
            const total = data.patients_created || patientCount
            let i = 0
            const tick = setInterval(() => {
                i = Math.min(i + Math.ceil(total / 20), total)
                setAnimCount(i)
                if (i >= total) clearInterval(tick)
            }, 60)
            setResult(data)
        } catch (e) {
            setError(e.response?.data?.message || 'Simulation failed')
        } finally {
            setRunning(false)
        }
    }

    const selectedScenario = SCENARIOS.find(s => s.id === scenario)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/50">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-violet-500/10 rounded-xl border border-violet-500/20 text-violet-400">⚡</span>
                        Live ER Simulation
                    </h1>
                    <p className="text-slate-400 text-sm mt-1.5">Flood the system with simulated patients. Watch AI triage in action.</p>
                </div>
                {result && (
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-black uppercase tracking-widest animate-in zoom-in-95">
                        ✅ Simulation Complete
                    </div>
                )}
            </div>

            {/* Scenario Selection */}
            <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Select Scenario</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SCENARIOS.map(s => (
                        <button key={s.id} onClick={() => setScenario(s.id)}
                            style={{
                                background: scenario === s.id ? s.bg : 'rgba(15,23,42,0.4)',
                                border: `2px solid ${scenario === s.id ? s.border : 'rgba(51,65,85,0.4)'}`,
                                borderRadius: 16, padding: '1.25rem 1.5rem', cursor: 'pointer',
                                textAlign: 'left', transition: 'all 0.2s', color: '#e2e8f0',
                                transform: scenario === s.id ? 'scale(1.01)' : 'scale(1)',
                            }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: scenario === s.id ? s.color : '#cbd5e1', marginBottom: '0.35rem' }}>
                                {s.label}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>{s.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-end gap-6 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Patient Count</div>
                    <div className="flex items-center gap-3">
                        {[10, 20, 30, 50].map(n => (
                            <button key={n} onClick={() => setPatientCount(n)}
                                className={`px-4 py-2.5 rounded-xl text-sm font-black border transition-all active:scale-95 ${patientCount === n
                                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}>{n}</button>
                        ))}
                    </div>
                </div>
                <button onClick={runSim} disabled={running}
                    style={{
                        marginLeft: 'auto', padding: '1rem 2.5rem', borderRadius: 14, border: 'none',
                        background: running
                            ? 'rgba(139,92,246,0.3)'
                            : `linear-gradient(135deg, ${selectedScenario?.color || '#6366f1'}, #6366f1)`,
                        color: '#fff', fontWeight: 800, fontSize: '1.05rem', cursor: running ? 'not-allowed' : 'pointer',
                        boxShadow: running ? 'none' : '0 0 30px rgba(99,102,241,0.4)', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                    }}>
                    {running ? (
                        <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Simulating...</>
                    ) : (
                        <>⚡ LAUNCH SIMULATION</>
                    )}
                </button>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-rose-400 font-semibold">
                    ⚠ {error}
                </div>
            )}

            {/* Live counter */}
            {running && (
                <div className="flex flex-col items-center justify-center py-12 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Injecting Patients into ER</div>
                    <div className="text-7xl font-black text-violet-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{animCount}</div>
                    <div className="text-slate-500 text-sm mt-2">patients processed</div>
                    <div className="mt-6 w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min((animCount / patientCount) * 100, 100)}%` }} />
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !running && (
                <div className="space-y-6">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Demo Metrics</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Patients Created', value: result.patients_created, icon: '🧑‍⚕️', color: 'text-blue-400' },
                            { label: 'Auto-Assigned', value: result.auto_assigned, icon: '✅', color: 'text-emerald-400' },
                            { label: 'Escalations', value: result.escalations_triggered, icon: '🚨', color: 'text-rose-400' },
                            { label: 'Unassigned', value: result.patients_created - result.auto_assigned, icon: '⚠️', color: 'text-amber-400' },
                        ].map(s => (
                            <div key={s.label} className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 text-center shadow-xl">
                                <div className="text-3xl mb-2">{s.icon}</div>
                                <div className={`text-4xl font-black ${s.color} tracking-tighter`}>{s.value ?? 0}</div>
                                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-2">{s.label}</div>
                            </div>
                        ))}
                    </div>
                    {result.priority_breakdown && (
                        <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-6">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Priority Breakdown</div>
                            <div className="flex gap-3 flex-wrap">
                                {Object.entries(result.priority_breakdown).map(([p, count]) => (
                                    <div key={p} className={`flex items-center gap-2 px-4 py-2 rounded-xl border bg-slate-950/40 ${p === 'critical' ? 'border-rose-500/30 text-rose-400' :
                                            p === 'high' ? 'border-orange-500/30 text-orange-400' :
                                                p === 'moderate' ? 'border-amber-500/30 text-amber-400' :
                                                    'border-emerald-500/30 text-emerald-400'
                                        }`}>
                                        <span className="font-black text-xl">{count}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{p}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-4 text-center">
                        <p className="text-slate-500 text-xs font-medium">
                            Go to <strong className="text-blue-400">ED Queue</strong> (Nurse view) to see all {result.patients_created} patients sorted by AI triage priority in real-time.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function AdminDashboard() {
    return (
        <Shell>
            <Routes>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="starvation" element={<StarvationPage />} />
                <Route path="forecast" element={<ForecastPage />} />
                <Route path="simulate" element={<SimulationPage />} />
                <Route path="config" element={<ConfigPage />} />
                <Route path="staff" element={<StaffPage />} />
            </Routes>
        </Shell>
    )
}
