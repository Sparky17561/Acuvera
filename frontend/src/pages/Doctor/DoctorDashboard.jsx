import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Shell from '../../components/Shell'
import { EncounterAPI, AllocationAPI, EscalationAPI, AdminAPI, AssessmentAPI } from '../../api/client'
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
            const filtered = (Array.isArray(docs) ? docs : []).filter(d => d.id !== currentUserId)
            setDoctors(filtered)
            // Pre-select suggested doctor only if it's not self
            if (sug?.doctor_id && sug.doctor_id !== currentUserId) setSelectedDoc(sug.doctor_id)
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
                        {suggestion?.success && suggestion.doctor_id !== currentUserId && (
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
    const [loading, setLoading] = useState(true)
    const [rejectEnc, setRejectEnc] = useState(null)
    const [escalateEnc, setEscalateEnc] = useState(null)
    const [referEnc, setReferEnc] = useState(null)
    const [assessEnc, setAssessEnc] = useState(null)
    const [actionLoading, setActionLoading] = useState({})

    const load = useCallback(async () => {
        try {
            const all = await EncounterAPI.list({ status: '' })
            const mine = Array.isArray(all) ? all.filter(e =>
                e.assigned_doctor === user?.id &&
                !['completed', 'cancelled'].includes(e.status)
            ) : []
            setCases(mine)
        } catch { setCases([]) }
        finally { setLoading(false) }
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
        <div>
            <EscalationAlertBanner />
            <div className="page-header">
                <div>
                    <div className="page-title">📂 My Cases</div>
                    <div className="page-subtitle">{cases.length} assigned to you</div>
                </div>
                <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
            </div>

            {cases.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">📭</div><p>No cases assigned</p></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {cases.map(enc => (
                        <div key={enc.id} className="card">
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{enc.patient_detail?.name || 'Unknown Patient'}</span>
                                        <PriorityBadge priority={enc.priority} />
                                        <span className="tag">{enc.status}</span>
                                        {enc.has_assessment && enc.assessment_completed && (
                                            <span style={{ fontSize: '0.72rem', background: 'rgba(34,197,94,0.15)', color: 'var(--success)', borderRadius: 4, padding: '0.1rem 0.4rem', fontWeight: 600 }}>
                                                ✅ Assessed
                                            </span>
                                        )}
                                        {enc.has_assessment && !enc.assessment_completed && (
                                            <span style={{ fontSize: '0.72rem', background: 'rgba(234,179,8,0.15)', color: 'var(--warn)', borderRadius: 4, padding: '0.1rem 0.4rem', fontWeight: 600 }}>
                                                🩺 Assessing...
                                            </span>
                                        )}
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', background: 'var(--surface2)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                                            📍 Floor {enc.floor || '?'}, Room {enc.room_number || '?'}, Bed {enc.bed_number || '?'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        <span>⏱ Wait: <strong style={{ color: 'var(--text)' }}>{waitLabel(enc.created_at)}</strong></span>
                                        <span>📊 Score: <strong style={{ color: 'var(--text)' }}>{enc.risk_score}</strong></span>
                                        <span>🎯 Confidence: <strong style={{ color: 'var(--text)' }}>{enc.confidence_score ?? '—'}%</strong></span>
                                        {enc.rejection_count > 0 && <span style={{ color: 'var(--warn)' }}>⚠️ {enc.rejection_count} prior reject(s)</span>}
                                    </div>
                                    {enc.triage_data?.vitals_json && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                            {Object.entries(enc.triage_data.vitals_json).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join('  •  ')}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 120 }}>
                                    {enc.status === 'assigned' && (
                                        <button className="btn btn-success" disabled={actionLoading[enc.id] === 'accepting'} onClick={() => acceptCase(enc)}>
                                            {actionLoading[enc.id] === 'accepting' ? '...' : '✓ Accept'}
                                        </button>
                                    )}
                                    {(enc.status === 'in_progress' || enc.status === 'assigned') && (
                                        <button className="btn btn-primary" onClick={() => setAssessEnc(enc)}>
                                            🩺 Assess
                                        </button>
                                    )}
                                    <button className="btn btn-warn" onClick={() => setEscalateEnc(enc)}>🚨 Escalate</button>
                                    <button className="btn btn-primary" style={{ fontSize: '0.8rem', background: 'var(--surface2)', color: 'var(--text)' }} onClick={() => setReferEnc(enc)}>🔄 Refer</button>
                                    <button className="btn btn-ghost" onClick={() => setRejectEnc(enc)}>✗ Reject</button>
                                </div>
                            </div>
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
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">📬 Pending Assignments</div>
                    <div className="page-subtitle">Accept or reject new cases — refreshes every 15s</div>
                </div>
                <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
            </div>
            {pending.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">✅</div><p>No pending assignments</p></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {pending.map(enc => (
                        <div key={enc.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                            <div>
                                <span style={{ fontWeight: 600 }}>{enc.patient_detail?.name || 'Patient'}</span>
                                <span style={{ marginLeft: '0.75rem' }}><PriorityBadge priority={enc.priority} /></span>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                    Score {enc.risk_score} • Wait {waitLabel(enc.created_at)}
                                    {enc.triage_data?.vitals_json && (
                                        <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace' }}>
                                            •{' '}{Object.entries(enc.triage_data.vitals_json).filter(([, v]) => v != null).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.3rem' }}>
                                    📍 Floor {enc.floor || '?'}, Room {enc.room_number || '?'}, Bed {enc.bed_number || '?'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-success" disabled={actionLoading[enc.id] === 'accepting'} onClick={() => accept(enc)}>
                                    {actionLoading[enc.id] === 'accepting' ? '...' : '✓ Accept'}
                                </button>
                                <button className="btn btn-ghost" onClick={() => setRejectEnc(enc)}>✗ Reject</button>
                            </div>
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
