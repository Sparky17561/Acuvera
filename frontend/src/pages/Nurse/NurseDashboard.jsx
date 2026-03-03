import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Shell from '../../components/Shell'
import { EncounterAPI, PatientAPI, TriageAPI, AllocationAPI, EscalationAPI } from '../../api/client'

// ─── Helpers ──────────────────────────────────────────────────
function PriorityBadge({ priority }) {
    return <span className={`badge badge-${priority}`}>{priority}</span>
}

function waitLabel(createdAt) {
    const mins = Math.floor((Date.now() - new Date(createdAt)) / 60000)
    if (mins < 1) return '< 1m'
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ─── Triage Modal ─────────────────────────────────────────────
function TriageModal({ encounter, onClose, onResult }) {
    const [form, setForm] = useState({
        raw_input_text: '', hr: '', spo2: '', bp_systolic: '', bp_diastolic: '',
        temp: '', rr: '', gcs: '', pain_score: '',
        symptoms: '', red_flags: [],
    })
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)

    const RED_FLAG_OPTIONS = [
        'cardiac_arrest', 'no_pulse', 'severe_hemorrhage', 'airway_compromised',
        'chest_pain', 'stroke_symptoms', 'seizure', 'shortness_of_breath',
    ]

    const toggleRedFlag = (flag) => {
        setForm(f => ({
            ...f,
            red_flags: f.red_flags.includes(flag)
                ? f.red_flags.filter(r => r !== flag)
                : [...f.red_flags, flag],
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const vitals = {}
            const numericFields = ['hr', 'spo2', 'bp_systolic', 'bp_diastolic', 'temp', 'rr', 'gcs', 'pain_score']
            numericFields.forEach(f => { if (form[f]) vitals[f] = parseFloat(form[f]) })
            const symptoms = form.symptoms.split(',').map(s => s.trim()).filter(Boolean)
            const red_flags = Object.fromEntries(form.red_flags.map(r => [r, true]))
            const res = await TriageAPI.analyze(encounter.id, {
                raw_input_text: form.raw_input_text,
                vitals, symptoms, red_flags,
            })
            setResult(res)
            onResult(res)
        } catch (err) {
            const errs = err.response?.data?.errors || err.message
            alert('Triage failed: ' + (typeof errs === 'object' ? JSON.stringify(errs) : errs))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">🔬 Triage Analysis — {encounter.patient_detail?.name || 'Patient'}</div>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={onClose}>✕</button>
                </div>

                {result ? (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <PriorityBadge priority={result.priority} />
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>Score: {result.effective_score}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Confidence: {result.confidence_score}%</span>
                        </div>
                        {result.hard_override && (
                            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', color: 'var(--critical)', fontWeight: 600 }}>
                                ⚠️ HARD OVERRIDE TRIGGERED
                            </div>
                        )}
                        {result.explanation_text && (
                            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                {result.explanation_text}
                            </div>
                        )}
                        <div className="section-label">Contributing Reasons</div>
                        <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: 2, color: 'var(--text-muted)' }}>
                            {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={onClose}>Done ✓</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Chief Complaint / Hinglish Text (optional)</label>
                            <textarea
                                rows={2}
                                placeholder="e.g. Seena mein dard ho raha hai aur saas lene mein takleef..."
                                value={form.raw_input_text}
                                onChange={e => setForm(f => ({ ...f, raw_input_text: e.target.value }))}
                            />
                        </div>
                        <div className="section-label">Vitals</div>
                        <div className="form-row">
                            {[['hr', 'HR (bpm)'], ['spo2', 'SpO₂ (%)'], ['bp_systolic', 'BP Sys'], ['bp_diastolic', 'BP Dia'],
                            ['temp', 'Temp (°F)'], ['rr', 'RR (/min)'], ['gcs', 'GCS'], ['pain_score', 'Pain (0-10)']].map(([k, lbl]) => (
                                <div className="form-group" key={k}>
                                    <label>{lbl}</label>
                                    <input type="number" step="any" placeholder="—"
                                        value={form[k]}
                                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                                </div>
                            ))}
                        </div>
                        <div className="form-group">
                            <label>Symptoms <span style={{ color: 'var(--text-muted)' }}>(comma-separated)</span></label>
                            <input placeholder="chest_pain, shortness_of_breath, sweating"
                                value={form.symptoms}
                                onChange={e => setForm(f => ({ ...f, symptoms: e.target.value }))} />
                        </div>
                        <div className="section-label">Red Flags</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                            {RED_FLAG_OPTIONS.map(flag => (
                                <button key={flag} type="button"
                                    className={`btn ${form.red_flags.includes(flag) ? 'btn-danger' : 'btn-ghost'}`}
                                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                                    onClick={() => toggleRedFlag(flag)}>
                                    {flag.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
                            <button className="btn btn-primary" type="submit" disabled={loading}>
                                {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyzing...</> : '🔬 Analyze'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}

// ─── New Patient Modal ────────────────────────────────────────
function NewPatientModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ name: '', age: '', gender: 'unknown', contact_phone: '', dob: '' })
    const [step, setStep] = useState('patient') // 'patient' → 'encounter'
    const [patient, setPatient] = useState(null)
    const [dept, setDept] = useState('')
    const [depts, setDepts] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        import('../../api/client').then(m => m.AdminAPI.departments()).then(setDepts).catch(() => { })
    }, [])

    const createPatient = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const payload = { ...form, age: parseInt(form.age) || null }
            if (!payload.dob) delete payload.dob // Django expects null or missing, not ''
            const p = await PatientAPI.create(payload)
            setPatient(p)
            setStep('encounter')
        } catch (err) {
            const errs = err.response?.data?.errors || err.message
            alert('Error: ' + (typeof errs === 'object' ? JSON.stringify(errs) : errs))
        } finally { setLoading(false) }
    }

    const createEncounter = async () => {
        if (!dept) { alert('Select department'); return }
        setLoading(true)
        try {
            const enc = await EncounterAPI.create({ patient_id: patient.id, department_id: dept })
            onCreated(enc)
            onClose()
        } catch (err) {
            const errs = err.response?.data?.errors || err.message
            alert('Error: ' + (typeof errs === 'object' ? JSON.stringify(errs) : errs))
        } finally { setLoading(false) }
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">🆕 New Patient Registration</div>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={onClose}>✕</button>
                </div>
                {step === 'patient' ? (
                    <form onSubmit={createPatient}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Full Name *</label>
                                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ramesh Kumar" />
                            </div>
                            <div className="form-group">
                                <label>Age</label>
                                <input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="45" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Gender</label>
                                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                                    <option value="unknown">Unknown</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="9876543210" />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
                            <button className="btn btn-primary" type="submit" disabled={loading}>
                                {loading ? 'Creating...' : 'Next →'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Patient <strong style={{ color: 'var(--text)' }}>{patient?.name}</strong> created. Choose department:
                        </p>
                        <div className="form-group">
                            <label>Department *</label>
                            <select value={dept} onChange={e => setDept(e.target.value)}>
                                <option value="">— Select —</option>
                                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                            <button className="btn btn-primary" onClick={createEncounter} disabled={loading}>
                                {loading ? 'Creating...' : '🚨 Open Encounter'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Queue Page ───────────────────────────────────────────────
function QueuePage() {
    const [encounters, setEncounters] = useState([])
    const [loading, setLoading] = useState(true)
    const [showNewPatient, setShowNewPatient] = useState(false)
    const [triageEnc, setTriageEnc] = useState(null)
    const [escalating, setEscalating] = useState(null)
    const navigate = useNavigate()

    const load = useCallback(async () => {
        try {
            const data = await EncounterAPI.list({ status: '' })
            setEncounters(Array.isArray(data) ? data : [])
        } catch { setEncounters([]) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        load()
        const t = setInterval(load, 30000)
        return () => clearInterval(t)
    }, [load])

    const triggerCodeBlue = async (enc) => {
        if (!confirm(`Trigger CODE BLUE for ${enc.patient_detail?.name || 'patient'}?`)) return
        try {
            await EscalationAPI.trigger({ encounter_id: enc.id, type: 'code_blue' })
            load()
        } catch (err) { alert('Error: ' + (err.response?.data?.errors || err.message)) }
    }

    const suggestAndAssign = async (enc) => {
        try {
            const res = await AllocationAPI.suggest(enc.id)
            if (!res.success) { alert(res.error || 'No available doctors'); return }
            if (!confirm(`Assign to Dr. ${res.doctor_name} (workload: ${res.workload_score})?`)) return
            await AllocationAPI.confirm({ encounter_id: enc.id, to_doctor_id: res.doctor_id })
            load()
        } catch (err) { alert('Error: ' + (err.response?.data?.errors || err.message)) }
    }

    if (loading) return <div className="loading-center"><div className="spinner" /><span>Loading queue...</span></div>

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">🚨 Active Queue</div>
                    <div className="page-subtitle">{encounters.length} encounters — auto-refreshes every 30s</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
                    <button className="btn btn-primary" onClick={() => setShowNewPatient(true)}>+ New Patient</button>
                </div>
            </div>

            {encounters.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">🏥</div><p>No active encounters</p></div>
            ) : (
                <div className="table-wrap card">
                    <table>
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>Wait</th>
                                <th>Priority</th>
                                <th>Score</th>
                                <th>Confidence</th>
                                <th>Doctor</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {encounters.map(enc => (
                                <tr key={enc.id} className={`row-${enc.priority}`}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{enc.patient_detail?.name || '—'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {enc.patient_detail?.age ? `${enc.patient_detail.age}y` : ''} {enc.patient_detail?.gender || ''}
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600, color: enc.triage_data ? 'var(--text)' : 'var(--text-muted)' }}>
                                            {waitLabel(enc.created_at)}
                                        </span>
                                    </td>
                                    <td><PriorityBadge priority={enc.priority} /></td>
                                    <td style={{ fontWeight: 600 }}>{enc.risk_score}</td>
                                    <td>
                                        {enc.confidence_score != null ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div className="confidence-bar-wrap" style={{ background: 'var(--surface2)', borderRadius: 4, height: 6, width: 60 }}>
                                                    <div style={{ height: '100%', borderRadius: 4, background: enc.confidence_score >= 70 ? 'var(--success)' : 'var(--warn)', width: `${enc.confidence_score}%` }} />
                                                </div>
                                                <span style={{ fontSize: '0.75rem' }}>{enc.confidence_score}%</span>
                                            </div>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td style={{ color: enc.assigned_doctor_detail ? 'var(--text)' : 'var(--text-muted)' }}>
                                        {enc.assigned_doctor_detail?.full_name || 'Unassigned'}
                                    </td>
                                    <td><span className="tag">{enc.status}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                            <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                onClick={() => setTriageEnc(enc)}>🔬 Triage</button>
                                            {!enc.assigned_doctor_detail && (
                                                <button className="btn btn-success" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                    onClick={() => suggestAndAssign(enc)}>👨‍⚕️ Assign</button>
                                            )}
                                            <button className="btn btn-danger" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                onClick={() => triggerCodeBlue(enc)}>🚨 Code Blue</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showNewPatient && (
                <NewPatientModal onClose={() => setShowNewPatient(false)} onCreated={(enc) => { setEncounters(e => [enc, ...e]); setTriageEnc(enc) }} />
            )}
            {triageEnc && (
                <TriageModal encounter={triageEnc} onClose={() => setTriageEnc(null)} onResult={() => { setTimeout(load, 1000) }} />
            )}
        </div>
    )
}

// ─── Dashboard shell ──────────────────────────────────────────
export default function NurseDashboard() {
    return (
        <Shell>
            <Routes>
                <Route index element={<Navigate to="queue" replace />} />
                <Route path="queue" element={<QueuePage />} />
                <Route path="triage" element={<QueuePage />} />
                <Route path="patients" element={<QueuePage />} />
            </Routes>
        </Shell>
    )
}
