import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, LineChart, Line, Legend
} from 'recharts'
import Shell from '../../components/Shell'
import { AdminAPI, AuthAPI } from '../../api/client'

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

    if (loading) return <div className="loading-center"><div className="spinner" /><span>Loading...</span></div>

    const priority_dist = data?.priority_distribution || { critical: 0, high: 0, moderate: 0, low: 0 }
    const priorityChartData = Object.entries(priority_dist).map(([name, value]) => ({ name, value }))
    const COLOR_MAP = { critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e' }

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">📊 Operations Overview</div>
                    <div className="page-subtitle">Live — refreshes every 60s</div>
                </div>
                <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
            </div>

            {/* Stats row */}
            <div className="card-grid card-grid-4" style={{ marginBottom: '1.5rem' }}>
                {[
                    { label: 'Active Patients', value: data?.active_patients ?? 0, icon: '🧑‍⚕️', color: 'var(--primary)' },
                    { label: 'Avg Wait', value: data?.avg_wait_time_seconds ? `${Math.floor(data.avg_wait_time_seconds / 60)}m` : '—', icon: '⏱', color: 'var(--warn)' },
                    { label: 'Starving', value: data?.starvation_count ?? 0, icon: '⚠️', color: data?.starvation_count > 0 ? 'var(--danger)' : 'var(--success)' },
                    { label: 'Overloaded Drs', value: data?.overloaded_doctors ?? 0, icon: '🏥', color: data?.overloaded_doctors > 0 ? 'var(--danger)' : 'var(--success)' },
                ].map(s => (
                    <div key={s.label} className="card">
                        <div className="stat-label">{s.icon} {s.label}</div>
                        <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Priority Distribution */}
            <div className="card-grid card-grid-3" style={{ marginBottom: '1.5rem' }}>
                <div className="card" style={{ gridColumn: '1 / 2' }}>
                    <div className="stat-label" style={{ marginTop: 0 }}>Priority Distribution</div>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={priorityChartData} barCategoryGap="30%">
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}
                                fill="#3b82f6"
                                label={false}
                                isAnimationActive={false}
                                cells={priorityChartData.map(d => (
                                    { fill: COLOR_MAP[d.name] || '#3b82f6' }
                                ))}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Starvation alerts */}
                <div className="card" style={{ gridColumn: '2 / 4' }}>
                    <div className="stat-label" style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        ⚠️ Starvation Alerts
                        {alerts.length > 0 && <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>{alerts.length}</span>}
                    </div>
                    {alerts.length === 0 ? (
                        <div style={{ color: 'var(--success)', padding: '1rem 0' }}>✅ No starving encounters</div>
                    ) : (
                        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                            {alerts.map(enc => (
                                <div key={enc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <span className={`badge badge-${enc.priority}`}>{enc.priority}</span>
                                    <span style={{ flex: 1, fontSize: '0.875rem' }}>{enc.patient_detail?.name || 'Patient'}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600 }}>{enc.wait_minutes}m waited</span>
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
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">📈 Peak Hour Forecast</div>
                    <div className="page-subtitle">Exponential smoothing over 90-day history</div>
                </div>
                <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-center" style={{ height: 300 }}><div className="spinner" /></div>
            ) : !forecast ? (
                <div className="empty-state"><div className="empty-state-icon">📊</div><p>No forecast data yet — needs 90 days of history.</p></div>
            ) : (
                <>
                    <div className="card-grid card-grid-3" style={{ marginBottom: '1.5rem' }}>
                        <div className="card">
                            <div className="stat-label">Peak Hour</div>
                            <div className="stat-value">{forecast.peak_hour}:00</div>
                            <div className="stat-sub">Expected: {forecast.peak_expected_count} arrivals</div>
                        </div>
                        <div className="card">
                            <div className="stat-label">Recommended Doctors</div>
                            <div className="stat-value">{forecast.staffing_suggestion?.recommended_doctors}</div>
                            <div className="stat-sub">Target wait: {forecast.staffing_suggestion?.target_avg_wait_minutes}min</div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="stat-label" style={{ marginTop: 0 }}>Hourly Arrival Forecast (next 7 days)</div>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="gradExpected" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={2} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                                <Area type="monotone" dataKey="expected" stroke="#3b82f6" fill="url(#gradExpected)" strokeWidth={2} name="Expected" />
                                <Area type="monotone" dataKey="high" stroke="#f97316" fill="none" strokeDasharray="4 2" strokeWidth={1} name="High estimate" />
                                <Area type="monotone" dataKey="low" stroke="#22c55e" fill="none" strokeDasharray="4 2" strokeWidth={1} name="Low estimate" />
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
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState(null)

    useEffect(() => {
        AdminAPI.config().then(c => { setConfig(c || {}); setLoading(false) }).catch(() => setLoading(false))
    }, [])

    const save = async () => {
        setSaving(true)
        try {
            await AdminAPI.updateConfig(config)
            setMsg({ type: 'success', text: 'Config saved.' })
        } catch (err) {
            setMsg({ type: 'danger', text: 'Save failed: ' + (err.response?.data?.errors || err.message) })
        } finally { setSaving(false); setTimeout(() => setMsg(null), 3000) }
    }

    if (loading) return <div className="loading-center"><div className="spinner" /></div>

    return (
        <div>
            <div className="page-header">
                <div className="page-title">⚙️ Hospital Config</div>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
            {msg && <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: `var(--${msg.type === 'success' ? 'success' : 'danger'})22`, color: `var(--${msg.type === 'success' ? 'success' : 'danger'})`, fontSize: '0.875rem' }}>{msg.text}</div>}
            {config ? (
                <div className="card" style={{ maxWidth: 640 }}>
                    <div className="form-group">
                        <label>Hospital Name</label>
                        <input value={config.hospital_name || ''} onChange={e => setConfig(c => ({ ...c, hospital_name: e.target.value }))} />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Max Cases / Doctor</label>
                            <input type="number" value={config.max_active_cases_per_doctor || 6} onChange={e => setConfig(c => ({ ...c, max_active_cases_per_doctor: parseInt(e.target.value) }))} />
                        </div>
                        <div className="form-group">
                            <label>Avg Revenue / Patient (₹)</label>
                            <input type="number" value={config.avg_revenue_per_patient || 500} onChange={e => setConfig(c => ({ ...c, avg_revenue_per_patient: parseFloat(e.target.value) }))} />
                        </div>
                    </div>
                    <div className="section-label">SLA Thresholds (seconds)</div>
                    <div className="form-row">
                        {[['sla_code_blue_seconds', 'Code Blue (s)'], ['sla_trauma_seconds', 'Trauma (s)'], ['sla_manual_seconds', 'Manual (s)']].map(([k, lbl]) => (
                            <div className="form-group" key={k}>
                                <label>{lbl}</label>
                                <input type="number" value={config[k] || ''} onChange={e => setConfig(c => ({ ...c, [k]: parseInt(e.target.value) }))} />
                            </div>
                        ))}
                    </div>
                    <div className="section-label">Feature Flags</div>
                    {Object.keys(config.feature_flags || {}).map(flag => (
                        <div key={flag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.9rem' }}>{flag}</span>
                            <button
                                className={`btn ${config.feature_flags[flag] ? 'btn-success' : 'btn-ghost'}`}
                                style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                                onClick={() => setConfig(c => ({ ...c, feature_flags: { ...c.feature_flags, [flag]: !c.feature_flags[flag] } }))}>
                                {config.feature_flags[flag] ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state"><p>No config found. Run <code>python manage.py seed_data</code> to seed.</p></div>
            )}
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
            setMsg({ type: 'success', text: 'User disabled successfully.' })
            if (editingId === id) cancelEdit()
            fetchStaff()
        } catch (err) {
            setMsg({ type: 'danger', text: 'Error deleting user: ' + (err.response?.data?.errors || err.message) })
        }
    }

    const handleEdit = (u) => {
        setEditingId(u.id)
        setForm({
            username: u.username || u.clerk_user_id || u.id.split('-')[0],
            password: '', // empty to keep existing password by default
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
                // If editing, send patch. Don't send empty password.
                const patchData = { ...form }
                if (!patchData.password) delete patchData.password
                await AdminAPI.updateStaff(editingId, patchData)
                setMsg({ type: 'success', text: `User ${form.full_name} successfully updated.` })
                cancelEdit()
            } else {
                await AuthAPI.register(form)
                setMsg({ type: 'success', text: `User ${form.full_name} successfully added.` })
                setForm({ username: '', password: '', email: '', full_name: '', role: 'doctor', department_id: '' })
            }
            fetchStaff()
        } catch (err) {
            setMsg({ type: 'danger', text: 'Error saving user: ' + (err.response?.data?.errors || err.message) })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">👨‍⚕️ Manage Staff</div>
                    <div className="page-subtitle">Add or edit nurses, doctors, or admins in the hospital</div>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 640 }}>
                <div style={{ fontWeight: 600, marginBottom: '1rem', color: editingId ? 'var(--primary)' : 'inherit' }}>
                    {editingId ? 'Edit Staff Member' : 'Add New Staff Member'}
                </div>
                {msg && (
                    <div style={{
                        marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8,
                        background: `var(--${msg.type} )22`,
                        color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                        fontSize: '0.875rem'
                    }}>
                        {msg.text}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Full Name</label>
                            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label>Role</label>
                            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                <option value="doctor">Doctor</option>
                                <option value="nurse">Nurse</option>
                                <option value="dept_head">Department Head</option>
                                <option value="admin">System Admin</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Login ID (Username)</label>
                            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. dr_smith" required />
                        </div>
                        <div className="form-group">
                            <label>Password {editingId && <span style={{ color: 'var(--text-muted)' }}>(Optional, leave blank to keep current)</span>}</label>
                            <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editingId ? "Enter new password to change" : "Temporary password"} required={!editingId} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Email Address</label>
                            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label>Department <span style={{ color: 'var(--text-muted)' }}>(Optional for Admins)</span></label>
                            <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} required={form.role === 'doctor' || form.role === 'nurse'}>
                                <option value="">Select Department...</option>
                                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                            {loading ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Staff Member')}
                        </button>
                        {editingId && (
                            <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="section-label" style={{ marginTop: '2.5rem', marginBottom: '1rem' }}>Active Staff Directory</div>

            {fetchingLogs ? <div className="loading-center"><div className="spinner" /></div> : staffList.length === 0 ? (
                <div className="empty-state"><p>No active staff found.</p></div>
            ) : (
                <div className="table-wrap card">
                    <table>
                        <thead>
                            <tr><th>Name</th><th>Login ID</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {staffList.filter(u => u.is_active).map(u => (
                                <tr key={u.id}>
                                    <td style={{ fontWeight: 600 }}>{u.full_name} <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{u.email}</div></td>
                                    <td><code style={{ background: 'var(--bg)', padding: '0.2rem 0.4rem', borderRadius: 4 }}>{u.username || u.clerk_user_id || u.id.split('-')[0]}</code></td>
                                    <td style={{ textTransform: 'capitalize' }}>{u.role.replace('_', ' ')}</td>
                                    <td><span className="badge badge-low">Active</span></td>
                                    <td>
                                        <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginRight: '0.5rem' }} onClick={() => handleEdit(u)}>Edit</button>
                                        <button className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleDelete(u.id)}>Disable</button>
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

export default function AdminDashboard() {
    return (
        <Shell>
            <Routes>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="starvation" element={<StarvationPage />} />
                <Route path="forecast" element={<ForecastPage />} />
                <Route path="config" element={<ConfigPage />} />
                <Route path="staff" element={<StaffPage />} />
            </Routes>
        </Shell>
    )
}
