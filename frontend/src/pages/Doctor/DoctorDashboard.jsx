import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Shell from '../../components/Shell'
import { EncounterAPI, PatientAPI, TriageAPI, AllocationAPI, EscalationAPI, AssessmentAPI } from '../../api/client'
import { Stethoscope, CheckCircle, AlertTriangle, Repeat, XCircle, Heart, Activity, Brain, Target, Clock, MapPin, ClipboardList, History, LayoutDashboard, ChevronRight, Info, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

// ─── Escalation Alert Banner ─────────────────────────────────────────────
function EscalationAlertBanner() {
    const [alerts, setAlerts] = useState([])  // unacknowledged escalation events
    const [responding, setResponding] = useState({})
    const [elapsed, setElapsed] = useState({})  // seconds since escalation per event
    const tickRef = useRef()

    const loadAlerts = useCallback(async () => {
        try {
            const events = await EscalationAPI.events({})
            const unacked = (Array.isArray(events) ? events : []).filter(e => !e.acknowledged_at)
            setAlerts(unacked)
        } catch { }
    }, [])

    useEffect(() => {
        loadAlerts()
        const t = setInterval(loadAlerts, 15000)
        return () => clearInterval(t)
    }, [loadAlerts])

    // Live elapsed timer
    useEffect(() => {
        tickRef.current = setInterval(() => {
            setElapsed(prev => {
                const next = { ...prev }
                alerts.forEach(ev => {
                    const secs = Math.floor((Date.now() - new Date(ev.timestamp)) / 1000)
                    next[ev.id] = secs
                })
                return next
            })
        }, 1000)
        return () => clearInterval(tickRef.current)
    }, [alerts])

    const handleRespond = async (eventId) => {
        setResponding(prev => ({ ...prev, [eventId]: true }))
        try {
            await EscalationAPI.acknowledge(eventId)
            setAlerts(prev => prev.filter(e => e.id !== eventId))
        } catch (err) {
            alert('Error: ' + (err.response?.data?.errors || err.message))
        } finally {
            setResponding(prev => ({ ...prev, [eventId]: false }))
        }
    }

    if (alerts.length === 0) return null

    const typeLabel = { code_blue: '🔵 CODE BLUE', trauma_override: '🚨 TRAUMA OVERRIDE', manual_escalation: '⚠️ ESCALATION' }

    return (
        <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alerts.map(ev => {
                const secs = elapsed[ev.id] || 0
                const mins = Math.floor(secs / 60)
                const s = secs % 60
                const timeStr = `${mins}:${String(s).padStart(2, '0')}`
                const isSlaRisk = secs > 90
                return (
                    <div key={ev.id} style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '2px solid var(--danger)',
                        borderRadius: 10,
                        padding: '0.85rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        animation: 'pulse-border 1.5s ease-in-out infinite',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--danger)', letterSpacing: '0.05em' }}>
                                {typeLabel[ev.type] || '🚨 ESCALATION'}
                            </span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                                Encounter <code style={{ background: 'var(--surface2)', padding: '0.1rem 0.3rem', borderRadius: 4 }}>{String(ev.encounter_id).slice(0, 8)}...</code>
                            </span>
                            <span style={{ fontSize: '0.85rem', color: isSlaRisk ? 'var(--danger)' : 'var(--warn)', fontWeight: 700, fontFamily: 'monospace' }}>
                                ⏱ {timeStr}{isSlaRisk ? ' — SLA AT RISK' : ''}
                            </span>
                        </div>
                        <button
                            className="btn btn-danger"
                            style={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 160 }}
                            disabled={responding[ev.id]}
                            onClick={() => handleRespond(ev.id)}
                        >
                            {responding[ev.id] ? 'Confirming...' : '🚨 I Am Responding'}
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

function PriorityBadge({ priority }) {
    return <span className={`badge badge-${priority}`}>{priority}</span>
}

function waitLabel(createdAt) {
    const mins = Math.floor((Date.now() - new Date(createdAt)) / 60000)
    if (mins < 1) return '< 1m'
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ─── Reject Modal ─────────────────────────────────────────────
function RejectModal({ encounter, onClose, onDone }) {
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)
    const REASONS = ['in_procedure', 'specialty_mismatch', 'max_caseload_reached', 'personal_emergency', 'outside_expertise', 'other']

    const handleReject = async () => {
        if (!reason) return
        setLoading(true)
        try {
            await AllocationAPI.respond({ encounter_id: encounter.id, accepted: false, rejection_reason: reason })
            onDone(); onClose()
        } catch (err) { alert('Error: ' + (err.response?.data?.errors || err.message)) }
        finally { setLoading(false) }
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">✗ Reject Assignment</div>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={onClose}>✕</button>
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    Rejecting <strong style={{ color: 'var(--text)' }}>{encounter.patient_detail?.name}</strong>. Select reason:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {REASONS.map(r => (
                        <button key={r} className={`btn ${reason === r ? 'btn-danger' : 'btn-ghost'}`}
                            style={{ justifyContent: 'flex-start' }} onClick={() => setReason(r)}>
                            {r.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-danger" onClick={handleReject} disabled={loading || !reason}>
                        {loading ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Escalate Modal ───────────────────────────────────────────
function EscalateModal({ encounter, onClose, onDone }) {
    const [type, setType] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const TYPES = [
        { value: 'code_blue', label: '🔵 Code Blue', desc: 'Cardiac/respiratory arrest — immediate response', color: 'var(--danger)' },
        { value: 'trauma_override', label: '🚨 Trauma Override', desc: 'Severe trauma requiring immediate team', color: '#f97316' },
        { value: 'manual_escalation', label: '⚠️ Manual Escalation', desc: 'Urgent clinical concern', color: 'var(--warn)' },
    ]

    const handleEscalate = async () => {
        if (!type) { setError('Select escalation type'); return }
        setLoading(true)
        try {
            await EscalationAPI.trigger({ encounter_id: encounter.id, type })
            onDone(); onClose()
        } catch (err) { setError(err.response?.data?.errors || err.message) }
        finally { setLoading(false) }
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">🚨 Trigger Escalation</div>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={onClose}>✕</button>
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    Patient: <strong style={{ color: 'var(--text)' }}>{encounter.patient_detail?.name}</strong>
                    <span className={`badge badge-${encounter.priority}`} style={{ marginLeft: '0.5rem' }}>{encounter.priority}</span>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {TYPES.map(t => (
                        <button key={t.value} onClick={() => setType(t.value)} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                            padding: '0.75rem 1rem', borderRadius: 8, border: `2px solid`,
                            borderColor: type === t.value ? t.color : 'var(--border)',
                            background: type === t.value ? `${t.color}18` : 'var(--surface2)',
                            cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                        }}>
                            <span style={{ fontWeight: 700, color: type === t.value ? t.color : 'var(--text)' }}>{t.label}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t.desc}</span>
                        </button>
                    ))}
                </div>
                {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠ {error}</div>}
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-danger" onClick={handleEscalate} disabled={loading || !type}>
                        {loading ? 'Escalating...' : '🚨 Confirm Escalation'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Refer Modal ──────────────────────────────────────────────
function ReferModal({ encounter, currentUserId, onClose, onDone }) {
    const [suggestion, setSuggestion] = useState(null)
    const [doctors, setDoctors] = useState([])
    const [selectedDoc, setSelectedDoc] = useState('')
    const [loading, setLoading] = useState(false)
    const [suggesting, setSuggesting] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        Promise.all([
            AllocationAPI.suggest(encounter.id).catch(() => null),
            AdminAPI.doctors(encounter.department).catch(() => []),
        ]).then(([sug, docs]) => {
            setSuggestion(sug)
            // Exclude self from both suggestion and list
            const filtered = (Array.isArray(docs) ? docs : []).filter(d => String(d.id) !== String(currentUserId))
            setDoctors(filtered)
            // Pre-select suggested doctor only if it's not self
            if (sug?.doctor_id && String(sug.doctor_id) !== String(currentUserId)) setSelectedDoc(sug.doctor_id)
            setSuggesting(false)
        })
    }, [encounter.id, encounter.department, currentUserId])

    const handleRefer = async () => {
        if (!selectedDoc) { setError('Select a doctor'); return }
        setLoading(true); setError(null)
        try {
            await AllocationAPI.refer({ encounter_id: encounter.id, to_doctor_id: selectedDoc })
            onDone(); onClose()
        } catch (err) { setError(err.response?.data?.errors || err.message) }
        finally { setLoading(false) }
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">🔄 Refer Patient</div>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={onClose}>✕</button>
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    Transfer <strong style={{ color: 'var(--text)' }}>{encounter.patient_detail?.name}</strong> to another doctor in this department.
                </p>
                {suggesting ? (
                    <div className="loading-center" style={{ height: 80 }}><div className="spinner" /></div>
                ) : (
                    <>
                        {suggestion?.success && String(suggestion.doctor_id) !== String(currentUserId) && (
                            <div style={{
                                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                                borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem',
                            }}>
                                <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.2rem' }}>🤖 AI Suggestion</div>
                                <strong>{suggestion.doctor_name}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                    Workload: {suggestion.workload_score} · {suggestion.availability_state}
                                </span>
                            </div>
                        )}
                        {doctors.length === 0 ? (
                            <div style={{ color: 'var(--warn)', padding: '0.75rem 0', fontSize: '0.9rem' }}>
                                ⚠ No other available doctors in this department.
                            </div>
                        ) : (
                            <div className="form-group">
                                <label>Select Doctor</label>
                                <select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)}>
                                    <option value="">— Choose doctor —</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.full_name}{suggestion?.doctor_id === d.id ? ' ⭐ Suggested' : ''} — {d.availability_state}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}
                {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠ {error}</div>}
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleRefer} disabled={loading || suggesting || !selectedDoc}>
                        {loading ? 'Referring...' : '🔄 Confirm Referral'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Assessment Modal ─────────────────────────────────────────
function AssessmentModal({ encounter, onClose, onDone }) {
    const [notes, setNotes] = useState('')
    const [media, setMedia] = useState([])   // [{name, mime_type, data_b64, preview}]
    const [saving, setSaving] = useState(false)
    const [completing, setCompleting] = useState(false)
    const [report, setReport] = useState(null)
    const [error, setError] = useState(null)
    const fileRef = useRef()

    // Load existing assessment
    useEffect(() => {
        AssessmentAPI.get(encounter.id).then(data => {
            if (data) {
                setNotes(data.notes || '')
                setMedia((data.media_json || []).map(m => ({ ...m, preview: `data:${m.mime_type};base64,${m.data_b64}` })))
                if (data.report_text) setReport(data.report_text)
            }
        }).catch(() => { })
    }, [encounter.id])

    const handleFileAdd = (e) => {
        const files = Array.from(e.target.files)
        files.forEach(file => {
            const reader = new FileReader()
            reader.onload = (ev) => {
                const dataUrl = ev.target.result
                const b64 = dataUrl.split(',')[1]
                setMedia(prev => [...prev, {
                    name: file.name,
                    mime_type: file.type,
                    data_b64: b64,
                    preview: dataUrl,
                }])
            }
            reader.readAsDataURL(file)
        })
        e.target.value = ''
    }

    const removeMedia = (idx) => setMedia(prev => prev.filter((_, i) => i !== idx))

    const handleSave = async () => {
        setSaving(true); setError(null)
        try {
            const newMedia = media.filter(m => !m._saved).map(({ name, mime_type, data_b64 }) => ({ name, mime_type, data_b64 }))
            await AssessmentAPI.save(encounter.id, { notes, media: newMedia })
            setMedia(prev => prev.map(m => ({ ...m, _saved: true })))
        } catch (err) { setError(err.response?.data?.errors || err.message) }
        finally { setSaving(false) }
    }

    const handleComplete = async () => {
        setCompleting(true); setError(null)
        try {
            const newMedia = media.filter(m => !m._saved).map(({ name, mime_type, data_b64 }) => ({ name, mime_type, data_b64 }))
            // Save any unsaved media first
            if (newMedia.length > 0) {
                await AssessmentAPI.save(encounter.id, { notes, media: newMedia })
            }
            const result = await AssessmentAPI.complete(encounter.id, { notes })
            setReport(result.report_text || 'Assessment completed.')
            setTimeout(() => { onDone(); }, 2000)
        } catch (err) { setError(err.response?.data?.errors || err.message) }
        finally { setCompleting(false) }
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                    <div className="modal-title">🩺 Assessment — {encounter.patient_detail?.name}</div>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={onClose}>✕</button>
                </div>

                {/* Patient summary */}
                <div style={{
                    background: 'var(--surface2)', borderRadius: 8, padding: '0.75rem 1rem',
                    marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)',
                    display: 'flex', gap: '1.5rem', flexWrap: 'wrap'
                }}>
                    <span><PriorityBadge priority={encounter.priority} /></span>
                    <span>Score: <strong style={{ color: 'var(--text)' }}>{encounter.risk_score}</strong></span>
                    <span>Wait: <strong style={{ color: 'var(--text)' }}>{waitLabel(encounter.created_at)}</strong></span>
                    {encounter.triage_data?.vitals_json && Object.entries(encounter.triage_data.vitals_json)
                        .filter(([, v]) => v != null).slice(0, 4)
                        .map(([k, v]) => <span key={k}>{k}: <strong style={{ color: 'var(--text)' }}>{v}</strong></span>)
                    }
                </div>

                {report ? (
                    // Show generated report
                    <div>
                        <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                            ✅ Assessment Complete — AI Report Generated
                        </div>
                        <div style={{
                            background: 'var(--surface2)', borderRadius: 8, padding: '1rem',
                            fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text)',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {report}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={onClose}>Close</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Notes */}
                        <div className="form-group">
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                CLINICAL NOTES
                            </label>
                            <textarea
                                rows={6}
                                placeholder="Enter clinical observations, examination findings, differential diagnosis, treatment plan..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                style={{ fontFamily: 'inherit', resize: 'vertical' }}
                            />
                        </div>

                        {/* Media */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                ATTACHMENTS (Photos / Documents)
                            </div>
                            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={handleFileAdd} />
                            <button className="btn btn-ghost" style={{ fontSize: '0.82rem' }} onClick={() => fileRef.current.click()}>
                                📎 Add Photo / File
                            </button>
                            {media.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    {media.map((m, i) => (
                                        <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                                            {m.mime_type?.startsWith('image/') ? (
                                                <img src={m.preview} alt={m.name} style={{
                                                    width: 80, height: 80, objectFit: 'cover',
                                                    borderRadius: 6, border: '1px solid var(--border)',
                                                }} />
                                            ) : (
                                                <div style={{
                                                    width: 80, height: 80, borderRadius: 6, border: '1px solid var(--border)',
                                                    background: 'var(--surface2)', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)',
                                                    textAlign: 'center', padding: '0.3rem',
                                                }}>📄 {m.name}</div>
                                            )}
                                            {!m._saved && (
                                                <button onClick={() => removeMedia(i)} style={{
                                                    position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                                                    borderRadius: '50%', background: 'var(--danger)',
                                                    color: '#fff', fontSize: 10, border: 'none', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>⚠ {error}</div>}

                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={onClose}>Close</button>
                            <button className="btn btn-ghost" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : '💾 Save Notes'}
                            </button>
                            <button className="btn btn-success" onClick={handleComplete} disabled={completing || !notes.trim()}>
                                {completing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating Report...</> : '✅ Complete Assessment'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ─── My Cases Page ────────────────────────────────────────────
function MyCasesPage() {
    const { user } = useAuthStore()
    const [cases, setCases] = useState([])
    const [pastCases, setPastCases] = useState([])
    const [loading, setLoading] = useState(true)
    const [rejectEnc, setRejectEnc] = useState(null)
    const [escalateEnc, setEscalateEnc] = useState(null)
    const [referEnc, setReferEnc] = useState(null)
    const [assessEnc, setAssessEnc] = useState(null)
    const [actionLoading, setActionLoading] = useState({})

    const load = useCallback(async () => {
        try {
            const [mine, past] = await Promise.all([
                EncounterAPI.list({ status: '', assigned_doctor: user?.id }).then(all => 
                    Array.isArray(all) ? all.filter(e => 
                        e.assigned_doctor === user?.id && !['completed', 'cancelled'].includes(e.status)
                    ) : []
                ),
                EncounterAPI.list({ status: 'completed', assigned_doctor: user?.id })
            ])
            setCases(mine)
            setPastCases(Array.isArray(past) ? past : [])
        } catch { 
            setCases([])
            setPastCases([])
        } finally { 
            setLoading(false) 
        }
    }, [user])

    useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

    const acceptCase = async (enc) => {
        setActionLoading(prev => ({ ...prev, [enc.id]: 'accepting' }))
        try {
            await AllocationAPI.respond({ encounter_id: enc.id, accepted: true })
            load()
        } catch (err) { alert('Error: ' + (err.response?.data?.errors || err.message)) }
        finally { setActionLoading(prev => ({ ...prev, [enc.id]: null })) }
    }

    if (loading) return <div className="loading-center"><div className="spinner" /><span>Loading cases...</span></div>

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <EscalationAlertBanner />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <LayoutDashboard className="text-blue-400" /> My Cases
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {cases.length} active patients requiring assessment
                    </p>
                </div>
                <button 
                    className="btn btn-ghost bg-slate-900 border-slate-700 hover:bg-slate-800" 
                    onClick={load}
                >
                    <RefreshCw size={16} className="text-blue-400" /> Refresh List
                </button>
            </div>

            {cases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-dashed border-slate-700/50">
                    <div className="text-5xl mb-4 opacity-20">🏥</div>
                    <p className="text-slate-500 font-medium">No active clinical encounters found</p>
                    <button className="mt-4 text-blue-400 text-sm hover:underline" onClick={load}>Reload Dashboard</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {cases.map(enc => (
                        <div key={enc.id} className={`group relative bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl transition-all hover:border-blue-500/30 hover:bg-slate-900/80 ${enc.status === 'escalated' ? 'ring-2 ring-rose-500/50 ring-offset-4 ring-offset-[#0f172a]' : ''}`}>
                            <div className="flex flex-col lg:flex-row gap-8">
                                {/* Left Section: Patient Info & Vitals */}
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-xl shadow-inner border border-white/5">
                                                👤
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
                                                    {enc.patient_detail?.name || 'Unknown Patient'}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <PriorityBadge priority={enc.priority} />
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-700">
                                                        {enc.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 font-bold text-xs">
                                            <MapPin size={12} />
                                            F {enc.floor || '?'} · R {enc.room_number || '?'} · B {enc.bed_number || '?'}
                                        </div>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                        <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 rounded-2xl border border-slate-700/30">
                                            <Clock size={14} className="text-slate-500" />
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">WAIT</div>
                                                <div className="text-sm font-bold text-slate-200">{waitLabel(enc.created_at)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 rounded-2xl border border-slate-700/30">
                                            <Activity size={14} className="text-amber-500" />
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">SCORE</div>
                                                <div className="text-sm font-bold text-slate-200">{enc.risk_score}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 rounded-2xl border border-slate-700/30">
                                            <Target size={14} className="text-emerald-500" />
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">CONF</div>
                                                <div className="text-sm font-bold text-slate-200">{enc.confidence_score ?? '—'}%</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 px-3 py-2 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                                            <Info size={14} className="text-rose-400" />
                                            <div>
                                                <div className="text-[10px] text-rose-400 font-bold uppercase tracking-tighter">REJECTS</div>
                                                <div className="text-sm font-bold text-rose-300">{enc.rejection_count}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Vitals Bar */}
                                    {enc.triage_data?.vitals_json && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-slate-900/80 p-3 rounded-2xl border border-slate-700/50">
                                            {[
                                                { k: 'HR', v: enc.triage_data.vitals_json.hr, icon: <Heart size={10} />, color: 'text-rose-400' },
                                                { k: 'BP', v: `${enc.triage_data.vitals_json.bp_systolic}/${enc.triage_data.vitals_json.bp_diastolic}`, icon: <Activity size={10} />, color: 'text-blue-400' },
                                                { k: 'O2', v: enc.triage_data.vitals_json.spo2, icon: <Activity className="rotate-90" size={10} />, color: 'text-emerald-400' },
                                                { k: 'T', v: enc.triage_data.vitals_json.temp, icon: <Activity size={10} />, color: 'text-amber-400' },
                                                { k: 'GCS', v: enc.triage_data.vitals_json.gcs, icon: <Brain size={10} />, color: 'text-indigo-400' },
                                                { k: 'Pain', v: enc.triage_data.vitals_json.pain_score, icon: <Info size={10} />, color: 'text-slate-400' },
                                            ].filter(v => v.v != null && v.v !== 'undefined/undefined').map(stat => (
                                                <div key={stat.k} className="flex items-center gap-2 px-2 py-1 bg-slate-800/50 rounded-lg">
                                                    <span className={stat.color}>{stat.icon}</span>
                                                    <span className="text-[10px] font-black text-slate-500">{stat.k}</span>
                                                    <span className="text-[11px] font-bold text-slate-200">{stat.v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right Section: Actions */}
                                <div className="flex flex-col justify-center gap-2 min-w-[160px] lg:border-l lg:border-slate-800 lg:pl-8">
                                    <div className="mb-2">
                                        {enc.has_assessment && enc.assessment_completed && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400 font-black text-[10px] tracking-widest text-center justify-center">
                                                <CheckCircle size={12} /> ASSESSED
                                            </div>
                                        )}
                                        {enc.has_assessment && !enc.assessment_completed && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400 font-black text-[10px] tracking-widest text-center justify-center animate-pulse">
                                                <Stethoscope size={12} /> ASSESSING...
                                            </div>
                                        )}
                                    </div>

                                    {enc.status === 'assigned' && (
                                        <button 
                                            className="w-full btn btn-success py-3 shadow-xl shadow-emerald-900/10 active:scale-95 transition-all" 
                                            disabled={actionLoading[enc.id] === 'accepting'} 
                                            onClick={() => acceptCase(enc)}
                                        >
                                            {actionLoading[enc.id] === 'accepting' ? '...' : <><CheckCircle size={16} /> Accept Case</>}
                                        </button>
                                    )}
                                    
                                    {(enc.status === 'in_progress' || enc.status === 'assigned' || enc.status === 'escalated') && (
                                        <button 
                                            className="w-full btn btn-primary py-3 shadow-xl shadow-blue-900/10 active:scale-95 transition-all" 
                                            onClick={() => setAssessEnc(enc)}
                                        >
                                            <Stethoscope size={16} /> Patient Assessment
                                        </button>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button className="btn btn-warn py-2.5 text-xs opacity-60 hover:opacity-100 transition-opacity" onClick={() => setEscalateEnc(enc)}>
                                            <AlertTriangle size={14} /> ALERT
                                        </button>
                                        <button className="btn btn-ghost py-2.5 text-xs bg-slate-900 border-slate-800" onClick={() => setReferEnc(enc)}>
                                            <Repeat size={14} /> REFER
                                        </button>
                                    </div>
                                    <button className="btn btn-ghost w-full py-2.5 text-xs bg-slate-900 border-slate-800 mt-1 opacity-40 hover:opacity-100 hover:text-rose-400 transition-all" onClick={() => setRejectEnc(enc)}>
                                        <XCircle size={14} /> Reject Assignment
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Past Patients Section ─── */}
            <div className="flex items-center justify-between mt-16 mb-8 border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <History className="text-slate-500" /> Patient History
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">{pastCases.length} records in current session</p>
                </div>
                <div className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Archive</div>
            </div>

            {pastCases.length === 0 ? (
                <div className="py-12 text-center bg-slate-900/20 rounded-3xl border border-slate-800/50">
                    <p className="text-slate-600 text-sm italic font-medium">No archived records available for this session</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pastCases.map(enc => (
                        <div key={enc.id} className="bg-slate-900/40 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 transition-all group overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg grayscale group-hover:grayscale-0 transition-all">👤</div>
                                    <div>
                                        <h4 className="font-bold text-slate-200">{enc.patient_detail?.name || 'Unknown'}</h4>
                                        <div className="text-[10px] text-slate-500 font-black tracking-widest uppercase mt-0.5">
                                            {new Date(enc.updated_at).toLocaleDateString()} · {new Date(enc.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2 bg-emerald-500/5 text-emerald-500/50 rounded-lg">
                                    <CheckCircle size={16} />
                                </div>
                            </div>

                            {enc.assessment_detail && (
                                <div className="relative">
                                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500/20 rounded-full" />
                                    <div className="pl-6">
                                        <div className="text-[10px] font-black text-emerald-500/80 uppercase tracking-[0.2em] mb-3">Electronic Medical Record Summary</div>
                                        <div className="text-sm text-slate-300 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-500">
                                            {enc.assessment_detail.report_text || 'No automated report available.'}
                                        </div>
                                        {enc.assessment_detail.notes && (
                                            <div className="mt-4 pt-4 border-t border-slate-800/50">
                                                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Physician Progress Notes</div>
                                                <div className="text-xs text-slate-400 italic bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                                                    "{enc.assessment_detail.notes}"
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {rejectEnc && <RejectModal encounter={rejectEnc} onClose={() => setRejectEnc(null)} onDone={load} />}
            {escalateEnc && <EscalateModal encounter={escalateEnc} onClose={() => setEscalateEnc(null)} onDone={load} />}
            {referEnc && <ReferModal encounter={referEnc} currentUserId={user?.id} onClose={() => setReferEnc(null)} onDone={load} />}
            {assessEnc && <AssessmentModal encounter={assessEnc} onClose={() => setAssessEnc(null)} onDone={() => { setAssessEnc(null); load() }} />}
        </div>
    )
}

// ─── Assignments Page ─────────────────────────────────────────
function AssignmentsPage() {
    const { user } = useAuthStore()
    const [pending, setPending] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState({})
    const [rejectEnc, setRejectEnc] = useState(null)

    const load = useCallback(async () => {
        try {
            const all = await EncounterAPI.list({ status: 'assigned' })
            const mine = Array.isArray(all) ? all.filter(e => e.assigned_doctor === user?.id) : []
            setPending(mine)
        } catch { setPending([]) }
        finally { setLoading(false) }
    }, [user])

    useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])

    const accept = async (enc) => {
        setActionLoading(prev => ({ ...prev, [enc.id]: 'accepting' }))
        try {
            await AllocationAPI.respond({ encounter_id: enc.id, accepted: true })
            load()
        } catch (err) { alert(err.response?.data?.errors || err.message) }
        finally { setActionLoading(prev => ({ ...prev, [enc.id]: null })) }
    }

    if (loading) return <div className="loading-center"><div className="spinner" /></div>

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <ClipboardList className="text-blue-400" /> Pending Assignments
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Accept or reject new cases — auto-refreshes every 15s
                    </p>
                </div>
                <button 
                    className="btn btn-ghost bg-slate-900 border-slate-700 hover:bg-slate-800" 
                    onClick={load}
                >
                    <RefreshCw size={16} className="text-blue-400" /> Force Refresh
                </button>
            </div>

            {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-dashed border-slate-700/50">
                    <div className="text-5xl mb-4 opacity-20">📭</div>
                    <p className="text-slate-500 font-medium">No pending assignments for you</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {pending.map(enc => (
                        <div key={enc.id} className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 group hover:border-blue-500/30 transition-all">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-5 w-full md:w-auto">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl">👤</div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-bold text-white text-lg">{enc.patient_detail?.name || 'Patient'}</h4>
                                            <PriorityBadge priority={enc.priority} />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400 font-medium">
                                            <span className="flex items-center gap-1"><Activity size={12} className="text-blue-500/50" /> Score {enc.risk_score}</span>
                                            <span className="flex items-center gap-1"><Clock size={12} className="text-amber-500/50" /> Wait {waitLabel(enc.created_at)}</span>
                                            <span className="flex items-center gap-1 text-blue-400 font-black"><MapPin size={12} /> F {enc.floor || '?'} · R {enc.room_number || '?'} · B {enc.bed_number || '?'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <button 
                                        className="flex-1 md:flex-none btn btn-success px-8 py-2.5 rounded-xl shadow-lg shadow-emerald-900/10 active:scale-95 transition-all" 
                                        disabled={actionLoading[enc.id] === 'accepting'} 
                                        onClick={() => accept(enc)}
                                    >
                                        {actionLoading[enc.id] === 'accepting' ? '...' : <><CheckCircle size={16} /> Accept</>}
                                    </button>
                                    <button 
                                        className="flex-1 md:flex-none btn btn-ghost px-6 py-2.5 rounded-xl bg-slate-950/50 border-slate-800 hover:text-rose-400 hover:border-rose-400/30 transition-all" 
                                        onClick={() => setRejectEnc(enc)}
                                    >
                                        <XCircle size={16} /> Reject
                                    </button>
                                </div>
                            </div>

                            {enc.triage_data?.vitals_json && (
                                <div className="mt-4 pt-4 border-t border-slate-800/50 flex flex-wrap gap-3">
                                    {Object.entries(enc.triage_data.vitals_json).filter(([, v]) => v != null).slice(0, 4).map(([k, v]) => (
                                        <div key={k} className="px-2 py-1 bg-slate-800/30 rounded-lg text-[10px] uppercase tracking-tighter text-slate-500 font-bold border border-slate-700/20">
                                            {k}: <span className="text-slate-300 ml-1">{v}</span>
                                        </div>
                                    ))}
                                    <div className="ml-auto text-blue-400/40 transform group-hover:translate-x-1 transition-transform">
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {rejectEnc && <RejectModal encounter={rejectEnc} onClose={() => setRejectEnc(null)} onDone={load} />}
        </div>
    )
}

export default function DoctorDashboard() {
    return (
        <Shell>
            <Routes>
                <Route index element={<Navigate to="my-cases" replace />} />
                <Route path="my-cases" element={<MyCasesPage />} />
                <Route path="assignments" element={<AssignmentsPage />} />
            </Routes>
        </Shell>
    )
}
