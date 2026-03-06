import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Shell from '../../components/Shell'
import { EncounterAPI, TriageAPI, AllocationAPI, EscalationAPI, AssessmentAPI, AdminAPI, InsightAPI } from '../../api/client'
import { Stethoscope, CheckCircle, AlertTriangle, Repeat, XCircle, Heart, Activity, Brain, Target, Clock, MapPin, ClipboardList, History, LayoutDashboard, ChevronRight, Info, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

// ─── Escalation Alert Banner ─────────────────────────────────────────────
const ICU_BEDS = [
    "ICU-A1", "ICU-A2", "ICU-A3", "ICU-A4",
    "ICU-B1", "ICU-B2", "ICU-B3", "ICU-B4",
]

function EscalationAlertBanner() {
    const [alerts, setAlerts] = useState([])  // unacknowledged escalation events
    const [elapsed, setElapsed] = useState({})  // seconds since escalation per event
    const [encounterMeta, setEncounterMeta] = useState({}) // encounter_id -> { patient_name, icu_bed }
    const tickRef = useRef()

    const loadAlerts = useCallback(async () => {
        try {
            const events = await EscalationAPI.events({})
            const dismissedAlerts = JSON.parse(localStorage.getItem('dismissedAlerts') || '[]')
            const unacked = (Array.isArray(events) ? events : []).filter(e => !e.acknowledged_at && !dismissedAlerts.includes(e.id))
            setAlerts(unacked)
            const newMeta = {}
            await Promise.all(unacked.map(async (ev, idx) => {
                if (!encounterMeta[ev.encounter_id]) {
                    try {
                        const enc = await EncounterAPI.get(ev.encounter_id)
                        newMeta[ev.encounter_id] = {
                            patient_name: enc.patient_detail?.name || 'Unknown Patient',
                            icu_bed: ev.type === 'code_blue' ? ICU_BEDS[idx % ICU_BEDS.length] : null,
                        }
                    } catch { }
                }
            }))
            if (Object.keys(newMeta).length > 0) setEncounterMeta(prev => ({ ...prev, ...newMeta }))
        } catch { }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
                    next[ev.id] = Math.floor((Date.now() - new Date(ev.timestamp)) / 1000)
                })
                return next
            })
        }, 1000)
        return () => clearInterval(tickRef.current)
    }, [alerts])

    // Doctors are just informed — dismiss removes from their local view only, no API call
    const handleDismiss = (eventId) => {
        const dismissedAlerts = JSON.parse(localStorage.getItem('dismissedAlerts') || '[]')
        if (!dismissedAlerts.includes(eventId)) {
            localStorage.setItem('dismissedAlerts', JSON.stringify([...dismissedAlerts, eventId]))
        }
        setAlerts(prev => prev.filter(e => e.id !== eventId))
    }

    if (alerts.length === 0) return null

    const typeLabel = { code_blue: '🚨 CODE BLUE', trauma_override: '🚨 TRAUMA OVERRIDE', manual_escalation: '⚠️ ESCALATION' }

    return (
        <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alerts.map(ev => {
                const secs = elapsed[ev.id] || 0
                const mins = Math.floor(secs / 60)
                const s = secs % 60
                const timeStr = `${mins}:${String(s).padStart(2, '0')}`
                const isSlaRisk = secs > 90
                const meta = encounterMeta[ev.encounter_id] || {}
                const patientName = meta.patient_name || 'Loading...'
                const icuBed = meta.icu_bed
                const isCodeBlue = ev.type === 'code_blue'
                return (
                    <div key={ev.id} style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '2px solid var(--danger)',
                        borderLeft: '6px solid var(--danger)',
                        borderRadius: 10,
                        padding: '0.85rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        animation: 'pulse-border 1.5s ease-in-out infinite',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--danger)', letterSpacing: '0.05em' }}>
                                {typeLabel[ev.type] || '🚨 ESCALATION'}
                            </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>
                                {patientName}
                            </span>
                            {icuBed && (
                                <span style={{
                                    background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444',
                                    borderRadius: 6, padding: '0.2rem 0.6rem',
                                    fontWeight: 800, fontSize: '0.78rem', color: '#fca5a5',
                                    fontFamily: 'monospace', letterSpacing: '0.06em',
                                }}>
                                    🏥 {icuBed}
                                </span>
                            )}
                            <span style={{ fontSize: '0.85rem', color: isSlaRisk ? 'var(--danger)' : 'var(--warn)', fontWeight: 700, fontFamily: 'monospace' }}>
                                ⏱ {timeStr}{isSlaRisk ? ' — SLA AT RISK' : ''}
                            </span>
                        </div>
                        {/* Doctors are alerted to go to the room — no action required, just dismiss */}
                        <button
                            onClick={() => handleDismiss(ev.id)}
                            title="Dismiss this alert from your view"
                            style={{
                                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                                borderRadius: 8, padding: '0.4rem 0.85rem',
                                fontWeight: 700, fontSize: '0.8rem', color: '#fca5a5',
                                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
                        >
                            ✕ Dismiss
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

function waitLabel(createdAt, endTime) {
    const end = endTime ? new Date(endTime).getTime() : Date.now()
    const mins = Math.floor((end - new Date(createdAt)) / 60000)
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

// ─── AI Insight Panel ────────────────────────────────────────
function AiInsightPanel({ encounterId, vitals = {} }) {
    const [insight, setInsight] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const generate = async () => {
        setLoading(true); setError(null)
        try {
            const data = await InsightAPI.generate(encounterId)
            setInsight(data)
        } catch (e) {
            setError('AI insight unavailable — using clinical judgment')
        } finally {
            setLoading(false)
        }
    }

    const confColor = (c) => c === 'high' ? '#22c55e' : c === 'medium' ? '#eab308' : '#94a3b8'

    // Vitals-based threshold rules — explain WHY each flag was raised using actual numbers
    const buildVitalsExplainability = (v, differentials) => {
        if (!v || Object.keys(v).length === 0) return []
        const explanations = []

        const hr = v.hr || v.heart_rate
        const spo2 = v.spo2 || v.oxygen_saturation
        const sbp = v.bp_systolic || v.systolic_bp
        const dbp = v.bp_diastolic || v.diastolic_bp
        const temp = v.temp || v.temperature
        const gcs = v.gcs
        const rr = v.rr || v.respiratory_rate
        const pain = v.pain_score

        if (hr) {
            if (hr > 140) explanations.push({ vital: 'HR', value: `${hr} bpm`, threshold: '>140 = severe tachycardia', flag: '🔴', reason: `Heart rate of ${hr} bpm is critically high (threshold >140 bpm). Severe tachycardia suggests haemodynamic instability — likely cause is acute blood loss, septic shock, or severe cardiac compromise.` })
            else if (hr > 100) explanations.push({ vital: 'HR', value: `${hr} bpm`, threshold: '>100 = tachycardia', flag: '🟠', reason: `Heart rate of ${hr} bpm indicates tachycardia (normal: 60–100 bpm). This points toward acute stress, pain, fever, dehydration, or early cardiovascular decompensation.` })
            else if (hr < 50) explanations.push({ vital: 'HR', value: `${hr} bpm`, threshold: '<50 = bradycardia', flag: '🟡', reason: `Heart rate of ${hr} bpm is bradycardic (normal: 60–100 bpm). Consider heart block, beta-blocker toxicity, or vagal overstimulation.` })
        }

        if (sbp) {
            if (sbp < 90) explanations.push({ vital: 'BP Systolic', value: `${sbp} mmHg`, threshold: '<90 = hypotension/shock', flag: '🔴', reason: `Systolic BP of ${sbp} mmHg is below the 90 mmHg shock threshold. This indicates haemodynamic compromise — urgent consideration for septic shock, cardiogenic shock, or haemorrhage.` })
            else if (sbp > 180) explanations.push({ vital: 'BP Systolic', value: `${sbp} mmHg`, threshold: '>180 = hypertensive crisis', flag: '🔴', reason: `Systolic BP of ${sbp} mmHg exceeds 180 mmHg — hypertensive urgency/emergency. Elevated risk of hypertensive stroke, aortic dissection, or acute pulmonary oedema.` })
            else if (sbp > 140) explanations.push({ vital: 'BP Systolic', value: `${sbp} mmHg`, threshold: '>140 = hypertension', flag: '🟡', reason: `Systolic BP of ${sbp} mmHg is above the 140 mmHg hypertension threshold. In an acute setting this contributes to cardiac, renal, and neurological stress.` })
        }

        if (spo2) {
            if (spo2 < 90) explanations.push({ vital: 'SpO₂', value: `${spo2}%`, threshold: '<90% = severe hypoxemia', flag: '🔴', reason: `SpO₂ of ${spo2}% is critically low (normal: 95–100%). Severe hypoxemia indicates significant respiratory failure — consistent with pulmonary embolism, pneumonia, or acute pulmonary oedema.` })
            else if (spo2 < 94) explanations.push({ vital: 'SpO₂', value: `${spo2}%`, threshold: '<94% = hypoxemia', flag: '🟠', reason: `SpO₂ of ${spo2}% is below the 94% clinical threshold. Moderate hypoxemia raises concern for pulmonary pathology — oxygen supplementation is likely needed.` })
        }

        if (temp) {
            if (temp > 38.5) explanations.push({ vital: 'Temp', value: `${temp}°C`, threshold: '>38.5°C = fever', flag: '🟠', reason: `Temperature of ${temp}°C indicates significant fever (threshold >38.5°C). This points to an active infectious or inflammatory process — sepsis screening warranted if other criteria present.` })
            else if (temp < 36.0) explanations.push({ vital: 'Temp', value: `${temp}°C`, threshold: '<36°C = hypothermia', flag: '🟡', reason: `Temperature of ${temp}°C is below normal (36–37.5°C). Hypothermia in an acute presentation may indicate sepsis, endocrine failure, or environmental exposure.` })
        }

        if (gcs) {
            if (gcs <= 8) explanations.push({ vital: 'GCS', value: `${gcs}/15`, threshold: '≤8 = severe neurological compromise', flag: '🔴', reason: `GCS of ${gcs}/15 is critically low (threshold ≤8 = comatose). This indicates severe neurological depression — airway protection is an immediate priority. Causes include stroke, TBI, metabolic encephalopathy, or toxidrome.` })
            else if (gcs < 13) explanations.push({ vital: 'GCS', value: `${gcs}/15`, threshold: '<13 = moderate impairment', flag: '🟠', reason: `GCS of ${gcs}/15 indicates moderate neurological impairment (normal: 15). Consider altered consciousness — causes include intracranial event, hypoglycaemia, hypoxia, or medication effect.` })
        }

        if (rr) {
            if (rr > 25) explanations.push({ vital: 'RR', value: `${rr} /min`, threshold: '>25 = tachypnoea', flag: '🟠', reason: `Respiratory rate of ${rr}/min is elevated (normal: 12–20/min). Significant tachypnoea indicates respiratory distress — consider pneumonia, PE, metabolic acidosis, or cardiac failure.` })
            else if (rr < 10) explanations.push({ vital: 'RR', value: `${rr} /min`, threshold: '<10 = bradypnoea', flag: '🟡', reason: `Respiratory rate of ${rr}/min is below normal. Bradypnoea suggests CNS depression, opiate toxicity, or severe metabolic derangement.` })
        }

        if (pain && pain >= 7) {
            explanations.push({ vital: 'Pain Score', value: `${pain}/10`, threshold: '≥7 = severe pain', flag: '🟠', reason: `Pain score of ${pain}/10 indicates severe pain (threshold ≥7). Severe pain in the acute setting warrants urgent analgesia and investigation — consistent with ACS, aortic dissection, or obstructive pathology.` })
        }

        return explanations
    }

    return (
        <div style={{
            border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10,
            background: 'rgba(99,102,241,0.07)', marginBottom: '1.25rem', overflow: 'hidden'
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 1rem', background: 'rgba(99,102,241,0.1)',
                borderBottom: insight ? '1px solid rgba(99,102,241,0.2)' : 'none'
            }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    🧠 AI Clinical Insight
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {insight?.cached && (
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>✓ Cached</span>
                    )}
                    <button
                        onClick={generate} disabled={loading}
                        style={{
                            fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.75rem',
                            borderRadius: 6, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                            background: loading ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.6)',
                            color: '#e0e7ff', transition: 'all 0.15s'
                        }}
                    >
                        {loading ? '⏳ Generating...' : insight ? '↻ Refresh' : '✦ Generate Insight'}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '0.6rem 1rem', fontSize: '0.78rem', color: '#f87171' }}>⚠ {error}</div>
            )}

            {insight && !error && (() => {
                // Build explanatory paragraph from differentials + investigations
                const topDiff = (insight.differentials || []).filter(d => d.confidence === 'high')[0] || insight.differentials?.[0]
                const secondDiff = (insight.differentials || []).filter(d => d !== topDiff)[0]
                const invNames = (insight.investigations || []).map(i => typeof i === 'string' ? i : i?.name).filter(Boolean).slice(0, 4)
                const highConf = (insight.differentials || []).filter(d => d.confidence === 'high').length

                // Vitals-based detailed explainability — the core new feature
                const vitalsExplanations = buildVitalsExplainability(vitals || {}, insight.differentials || [])

                const reasoning = insight.reasoning || insight.explanation || (
                    topDiff
                        ? `Based on the presenting clinical picture, ${topDiff.condition} is the most likely diagnosis${topDiff.reason ? ` — ${topDiff.reason.toLowerCase()}` : ''}. ` +
                        (secondDiff ? `${secondDiff.condition} should also be considered as a differential, particularly if initial tests are unrevealing. ` : '') +
                        (invNames.length ? `Priority investigations include ${invNames.join(', ')} to narrow the diagnosis and guide management. ` : '') +
                        (highConf > 1 ? `There are ${highConf} high-confidence differentials, indicating significant diagnostic uncertainty — clinical correlation is essential.` : 'Clinical correlation with bedside examination remains paramount.')
                        : null
                )
                const riskSignals = insight.risk_signals || [
                    ...(insight.differentials || []).filter(d => d.confidence === 'high').map(d => `Elevated suspicion for ${d.condition}`),
                    ...(insight.investigations || []).slice(0, 2).map(i => `Pending: ${typeof i === 'string' ? i : i?.name}`),
                ]
                const outcomes = insight.possible_outcomes || insight.outcomes || null

                return (
                    <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Differentials */}
                        <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: 3, height: 12, background: '#818cf8', borderRadius: 2, display: 'inline-block' }} />
                                Differential Diagnoses
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {(insight.differentials || []).map((d, i) => {
                                    const cc = confColor(d.confidence)
                                    return (
                                        <div key={i} style={{
                                            borderRadius: 8, border: `1px solid ${cc}30`,
                                            background: `${cc}08`, padding: '0.6rem 0.8rem',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: d.reason ? '0.3rem' : 0 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: cc }} />
                                                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem' }}>{d.condition}</span>
                                                <span style={{ fontSize: '0.62rem', color: cc, fontWeight: 800, marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${cc}50`, borderRadius: 4, padding: '0.1rem 0.35rem' }}>
                                                    {d.confidence}
                                                </span>
                                            </div>
                                            {d.reason && (
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5, paddingLeft: '1.1rem' }}>
                                                    {d.reason}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        {/* Investigations */}
                        <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: 3, height: 12, background: '#6366f1', borderRadius: 2, display: 'inline-block' }} />
                                Suggested Investigations
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                {(insight.investigations || []).map((inv, i) => {
                                    const name = typeof inv === 'string' ? inv : inv?.name
                                    const reason = typeof inv === 'object' ? inv?.reason : null
                                    return (
                                        <div key={i} style={{
                                            fontSize: '0.79rem', padding: '0.5rem 0.7rem',
                                            background: 'rgba(99,102,241,0.07)', borderRadius: 8,
                                            border: '1px solid rgba(99,102,241,0.15)',
                                            display: 'flex', flexDirection: 'column', gap: '0.2rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                                                <span style={{ color: '#6366f1', fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                                                <span style={{ color: '#e2e8f0', fontWeight: 600, lineHeight: 1.4 }}>{name}</span>
                                            </div>
                                            {reason && (
                                                <div style={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.4, paddingLeft: '1.1rem' }}>
                                                    {reason}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ─── Vitals-Based Explainability ─── */}
                        {vitalsExplanations.length > 0 && (
                            <div style={{
                                borderRadius: 10, border: '1px solid rgba(139,92,246,0.25)',
                                background: 'rgba(139,92,246,0.05)', padding: '0.85rem 1rem',
                            }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: 3, height: 12, background: '#8b5cf6', borderRadius: 2, display: 'inline-block' }} />
                                    Vital-Sign Threshold Analysis
                                    <span style={{ fontWeight: 500, textTransform: 'none', color: '#7c3aed', fontSize: '0.65rem', marginLeft: 'auto' }}>why these tests were suggested</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                    {vitalsExplanations.map((e, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(139,92,246,0.06)', borderRadius: 8,
                                            border: '1px solid rgba(139,92,246,0.15)', padding: '0.55rem 0.8rem',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                                <span style={{ fontSize: '0.85rem' }}>{e.flag}</span>
                                                <span style={{ fontWeight: 800, color: '#c4b5fd', fontSize: '0.8rem' }}>{e.vital}</span>
                                                <span style={{
                                                    fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem',
                                                    background: 'rgba(139,92,246,0.15)', padding: '0.1rem 0.45rem',
                                                    borderRadius: 5, color: '#e9d5ff', border: '1px solid rgba(139,92,246,0.3)'
                                                }}>{e.value}</span>
                                                <span style={{ fontSize: '0.65rem', color: '#7c3aed', fontWeight: 600, marginLeft: 'auto' }}>{e.threshold}</span>
                                            </div>
                                            <div style={{ fontSize: '0.77rem', color: '#c4b5fd', lineHeight: 1.55, paddingLeft: '1.6rem' }}>
                                                {e.reason}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ─── Risk Signals ─── */}
                        {riskSignals.length > 0 && (
                            <div style={{
                                borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)',
                                background: 'rgba(245,158,11,0.05)', padding: '0.75rem 1rem',
                            }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: 3, height: 12, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }} />
                                    Key Clinical Flags
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    {riskSignals.slice(0, 4).map((sig, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78rem', color: '#fcd34d' }}>
                                            <span style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }}>▸</span>
                                            <span style={{ lineHeight: 1.4 }}>{sig}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ─── Possible Outcomes ─── */}
                        {outcomes && Array.isArray(outcomes) && outcomes.length > 0 && (
                            <div style={{
                                borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)',
                                background: 'rgba(239,68,68,0.04)', padding: '0.75rem 1rem',
                            }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: 3, height: 12, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} />
                                    Possible Outcomes if Untreated
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    {outcomes.map((o, i) => (
                                        <div key={i} style={{ fontSize: '0.78rem', color: '#fca5a5', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                            <span style={{ color: '#ef4444', flexShrink: 0 }}>⚠</span>
                                            <span style={{ lineHeight: 1.4 }}>{typeof o === 'string' ? o : o?.outcome}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })()}

            {insight?.disclaimer && (
                <div style={{ padding: '0.4rem 1rem', fontSize: '0.65rem', color: '#475569', borderTop: '1px solid rgba(99,102,241,0.15)' }}>
                    {insight.disclaimer}
                </div>
            )}
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
                        {/* AI Clinical Insight Panel */}
                        <AiInsightPanel encounterId={encounter.id} vitals={encounter.triage_data?.vitals_json || {}} />

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
    const [referEnc, setReferEnc] = useState(null)
    const [assessEnc, setAssessEnc] = useState(null)

    const load = useCallback(async () => {
        try {
            const mine = await EncounterAPI.list({ status: '', assigned_doctor: user?.id }).then(all =>
                Array.isArray(all) ? all.filter(e =>
                    e.assigned_doctor === user?.id && ['in_progress', 'escalated'].includes(e.status) && !e.assessment_completed
                ) : []
            )
            setCases(mine)
        } catch {
            setCases([])
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

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
                        {cases.length} accepted cases in progress
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
                    <p className="text-slate-500 font-medium">No active cases — check <strong>Assignments</strong> for new cases to accept</p>
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
                                        {/* Location display (read-only — nurses manage location) */}
                                        {enc.floor && (
                                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs"
                                                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                                                <MapPin size={12} />
                                                F {enc.floor} · R {enc.room_number || '?'} · B {enc.bed_number || '?'}
                                            </div>
                                        )}
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

                                    {(enc.status === 'in_progress' || enc.status === 'escalated') && (
                                        <button
                                            className="w-full btn btn-primary py-3 shadow-xl shadow-blue-900/10 active:scale-95 transition-all"
                                            onClick={() => setAssessEnc(enc)}
                                        >
                                            <Stethoscope size={16} /> Patient Assessment
                                        </button>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button className="btn btn-warn py-2.5 text-xs opacity-60 hover:opacity-100 transition-opacity" onClick={async () => {
                                            const ok = window.confirm(`Send escalation alert for ${enc.patient_detail?.name || 'this patient'}?\n\nThis will notify the response team.`)
                                            if (!ok) return
                                            try {
                                                await EscalationAPI.trigger({ encounter_id: enc.id, type: 'manual_escalation' })
                                                load()
                                            } catch (err) {
                                                alert('Error: ' + (err.response?.data?.errors || err.message))
                                            }
                                        }}>
                                            <AlertTriangle size={14} /> ALERT
                                        </button>
                                        <button className="btn btn-ghost py-2.5 text-xs bg-slate-900 border-slate-800" onClick={() => setReferEnc(enc)}>
                                            <Repeat size={14} /> REFER
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {rejectEnc && <RejectModal encounter={rejectEnc} onClose={() => setRejectEnc(null)} onDone={load} />}
            {referEnc && <ReferModal encounter={referEnc} currentUserId={user?.id} onClose={() => setReferEnc(null)} onDone={load} />}
            {assessEnc && <AssessmentModal encounter={assessEnc} onClose={() => setAssessEnc(null)} onDone={() => { setAssessEnc(null); load() }} />}
        </div>
    )
}

// ─── Patient History Page ─────────────────────────────────────
const FormattedReport = ({ text }) => {
    if (!text) return 'No automated report available.';
    const lines = text.split('\n');
    const elements = [];

    let skipSection = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip redundant CLINICAL ASSESSMENT block on older saved fallback reports
        if (line === 'CLINICAL ASSESSMENT') {
            skipSection = true;
            continue;
        }
        if (skipSection) {
            // we skip until we hit a new section divider
            if (/^[-=]{5,}$/.test(line)) {
                // but the line before the divider was the header, which we also skipped, so we just continue skipping
                continue;
            }
            if (line === '' && i + 1 < lines.length && /^[A-Z\s]+$/.test(lines[i + 1].trim()) && /^[-=]{5,}$/.test(lines[i + 2]?.trim() || '')) {
                skipSection = false;
            }
            if (skipSection) continue;
        }

        // Check if current line is an ASCII divider
        if (/^[-=]{5,}$/.test(line)) {
            if (elements.length > 0) {
                const prev = elements.pop();
                elements.push({
                    type: 'header',
                    text: prev.text.replace(/[:-]$/, '').trim(), // Clean trailing colons
                    isMain: line.includes('=')
                });
            }
        } else if (line) {
            elements.push({ type: 'text', text: line });
        } else if (!line && elements.length > 0 && elements[elements.length - 1].type !== 'break') {
            elements.push({ type: 'break' });
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {elements.map((el, i) => {
                if (el.type === 'header') {
                    return (
                        <div key={i} style={{
                            marginTop: i > 0 ? '1.25rem' : '0.25rem',
                            marginBottom: '0.25rem',
                            fontSize: el.isMain ? '0.8rem' : '0.72rem',
                            fontWeight: 800,
                            color: el.isMain ? 'var(--text)' : 'var(--text-muted)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            borderBottom: '1px solid var(--border)',
                            paddingBottom: '0.4rem'
                        }}>
                            {el.text}
                        </div>
                    );
                } else if (el.type === 'break') {
                    return <div key={i} style={{ height: '0.2rem' }} />;
                }

                // For key-value pairs separated by colons or pipes, let's style them slightly better if they have a clear structure.
                let content = el.text;
                if (content.includes('|') && content.includes(':')) {
                    const parts = content.split('|').map(p => p.trim());
                    return (
                        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.25rem', marginTop: '0.25rem' }}>
                            {parts.map((part, idx) => {
                                const [k, ...v] = part.split(':');
                                return k && v.length ? (
                                    <span key={idx} style={{ background: 'var(--surface)', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                                        <strong style={{ color: 'var(--text-muted)' }}>{k.trim()}:</strong> <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{v.join(':').trim()}</span>
                                    </span>
                                ) : <span key={idx} style={{ fontSize: '0.85rem' }}>{part}</span>;
                            })}
                        </div>
                    );
                }

                return <div key={i} style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.55 }}>{content}</div>;
            })}
        </div>
    );
};

function PatientHistoryPage() {
    const { user } = useAuthStore()
    const [pastCases, setPastCases] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        try {
            const past = await EncounterAPI.list({ status: 'completed', assigned_doctor: user?.id })
            setPastCases(Array.isArray(past) ? past : [])
        } catch {
            setPastCases([])
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])

    if (loading) return <div className="loading-center"><div className="spinner" /><span>Loading history...</span></div>

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <EscalationAlertBanner />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <History className="text-slate-400" /> Patient History
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{pastCases.length} completed records</p>
                </div>
                <button className="btn btn-ghost bg-slate-900 border-slate-700 hover:bg-slate-800" onClick={load}>
                    <RefreshCw size={16} className="text-blue-400" /> Refresh
                </button>
            </div>

            {pastCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-dashed border-slate-700/50">
                    <div className="text-5xl mb-4 opacity-20">📋</div>
                    <p className="text-slate-500 font-medium">No completed cases in your history yet</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', paddingBottom: '2rem' }}>
                    {pastCases.map(enc => (
                        <div key={enc.id} style={{
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            padding: '1.25rem',
                            display: 'flex', flexDirection: 'column', gap: '1rem',
                        }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '50%', background: 'rgba(99,102,241,0.15)',
                                        color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                                    }}>
                                        👤
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
                                            {enc.patient_detail?.name || 'Unknown Patient'}
                                        </h4>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 600 }}>
                                            {new Date(enc.updated_at).toLocaleDateString()} · {new Date(enc.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    <PriorityBadge priority={enc.priority} />
                                    <div style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                                        <CheckCircle size={14} /> Completed
                                    </div>
                                </div>
                            </div>

                            {/* Info Bar */}
                            {(enc.floor || enc.room_number) && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: 8, width: 'fit-content' }}>
                                    <MapPin size={12} />
                                    {[enc.floor && `Floor ${enc.floor}`, enc.room_number && `Room ${enc.room_number}`, enc.bed_number && `Bed ${enc.bed_number}`].filter(Boolean).join(' · ')}
                                </div>
                            )}

                            {/* EMR Summary */}
                            {enc.assessment_detail && (
                                <div style={{
                                    background: 'var(--surface)', borderRadius: 8, padding: '1.25rem',
                                    border: '1px solid rgba(16,185,129,0.15)', borderLeft: '4px solid #10b981'
                                }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
                                        EMR System Summary
                                    </div>
                                    <FormattedReport text={enc.assessment_detail.report_text} />

                                    {enc.assessment_detail.notes && (
                                        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                                                Physician Progress Notes
                                            </div>
                                            <div style={{
                                                fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic',
                                                background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: 8,
                                                border: '1px solid var(--border)'
                                            }}>
                                                "{enc.assessment_detail.notes}"
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
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
                <Route path="history" element={<PatientHistoryPage />} />
            </Routes>
        </Shell>
    )
}
