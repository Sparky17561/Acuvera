import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Shell from '../../components/Shell'
import { EncounterAPI, AllocationAPI, EscalationAPI } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

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

    const REJECTION_REASONS = [
        'in_procedure', 'specialty_mismatch', 'max_caseload_reached',
        'personal_emergency', 'outside_expertise', 'other',
    ]

    const handleReject = async () => {
        if (!reason) { alert('Select a reason'); return }
        setLoading(true)
        try {
            await AllocationAPI.respond({ encounter_id: encounter.id, accepted: false, rejection_reason: reason })
            onDone()
            onClose()
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
                    Rejecting encounter for <strong style={{ color: 'var(--text)' }}>{encounter.patient_detail?.name || 'Patient'}</strong>.
                    Please select a reason:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {REJECTION_REASONS.map(r => (
                        <button key={r}
                            className={`btn ${reason === r ? 'btn-danger' : 'btn-ghost'}`}
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => setReason(r)}>
                            {r.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-danger" onClick={handleReject} disabled={loading}>
                        {loading ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                </div>
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

    const load = useCallback(async () => {
        try {
            const all = await EncounterAPI.list({ status: '' })
            const mine = Array.isArray(all) ? all.filter(e => e.assigned_doctor === user?.id) : []
            setCases(mine)
        } catch { setCases([]) }
        finally { setLoading(false) }
    }, [user])

    useEffect(() => {
        load()
        const t = setInterval(load, 30000)
        return () => clearInterval(t)
    }, [load])

    const acceptCase = async (enc) => {
        try {
            await AllocationAPI.respond({ encounter_id: enc.id, accepted: true })
            load()
        } catch (err) { alert('Error: ' + (err.response?.data?.errors || err.message)) }
    }

    const triggerEscalation = async (enc) => {
        const type = prompt('Escalation type:\ncode_blue | trauma_override | manual_escalation')
        if (!type) return
        try {
            await EscalationAPI.trigger({ encounter_id: enc.id, type })
            load()
        } catch (err) { alert('Error: ' + (err.response?.data?.errors || err.message)) }
    }

    if (loading) return <div className="loading-center"><div className="spinner" /><span>Loading cases...</span></div>

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">📂 My Cases</div>
                    <div className="page-subtitle">{cases.length} assigned to you</div>
                </div>
                <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
            </div>

            {cases.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <p>No cases assigned</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>New assignments will appear here and in Assignments tab.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {cases.map(enc => (
                        <div key={enc.id} className="card">
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                                            {enc.patient_detail?.name || 'Unknown Patient'}
                                        </span>
                                        <PriorityBadge priority={enc.priority} />
                                        <span className="tag">{enc.status}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        <span>⏱ Wait: <strong style={{ color: 'var(--text)' }}>{waitLabel(enc.created_at)}</strong></span>
                                        <span>📊 Score: <strong style={{ color: 'var(--text)' }}>{enc.risk_score}</strong></span>
                                        <span>🎯 Confidence: <strong style={{ color: 'var(--text)' }}>{enc.confidence_score ?? '—'}%</strong></span>
                                        {enc.rejection_count > 0 && <span style={{ color: 'var(--warn)' }}>⚠️ {enc.rejection_count} prior reject(s)</span>}
                                    </div>
                                    {enc.triage_data?.vitals_json && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                            {Object.entries(enc.triage_data.vitals_json)
                                                .filter(([, v]) => v != null)
                                                .map(([k, v]) => `${k}: ${v}`)
                                                .join('  •  ')}
                                        </div>
                                    )}
                                    {enc.notes && <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>📝 {enc.notes}</div>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {enc.status === 'assigned' && (
                                        <button className="btn btn-success" onClick={() => acceptCase(enc)}>✓ Accept</button>
                                    )}
                                    <button className="btn btn-warn" onClick={() => triggerEscalation(enc)}>🚨 Escalate</button>
                                    <button className="btn btn-ghost" onClick={() => setRejectEnc(enc)}>✗ Reject</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {rejectEnc && (
                <RejectModal encounter={rejectEnc} onClose={() => setRejectEnc(null)} onDone={load} />
            )}
        </div>
    )
}

// ─── Assignments Pending Page ─────────────────────────────────
function AssignmentsPage() {
    const { user } = useAuthStore()
    const [pending, setPending] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        try {
            const all = await EncounterAPI.list({ status: 'assigned' })
            const mine = Array.isArray(all) ? all.filter(e => e.assigned_doctor === user?.id) : []
            setPending(mine)
        } catch { setPending([]) }
        finally { setLoading(false) }
    }, [user])

    useEffect(() => {
        load()
        const t = setInterval(load, 15000)
        return () => clearInterval(t)
    }, [load])

    const accept = async (enc) => {
        try {
            await AllocationAPI.respond({ encounter_id: enc.id, accepted: true })
            load()
        } catch (err) { alert(err.response?.data?.errors || err.message) }
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
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Score {enc.risk_score} • Wait {waitLabel(enc.created_at)}</div>
                            </div>
                            <button className="btn btn-success" onClick={() => accept(enc)}>✓ Accept</button>
                        </div>
                    ))}
                </div>
            )}
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
