import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Shell from '../../components/Shell'
import { EncounterAPI, PatientAPI, TriageAPI, AllocationAPI, EscalationAPI, AssessmentAPI } from '../../api/client'
import { Stethoscope, UserPlus, UserCog, FileText, AlertTriangle, RefreshCw } from 'lucide-react'
import { saveDraft, getAllDrafts, deleteDraft } from '../../store/offlineStore'

// ─── Helpers ──────────────────────────────────────────────────
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

// ─── Report Viewer Modal ─────────────────────────────────────────
function ReportModal({ encounter, onClose }) {
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showRawNotes, setShowRawNotes] = useState(false)

    useEffect(() => {
        AssessmentAPI.get(encounter.id)
            .then(data => setReport(data))
            .catch(() => setReport(null))
            .finally(() => setLoading(false))
    }, [encounter.id])

    // Detect if LLM-generated (≤ 300 chars) vs structured fallback (starts with header)
    const isLLMReport = report?.report_text && !report.report_text.startsWith('EMERGENCY DEPARTMENT')

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                    <div className="modal-title">📋 Assessment Report — {encounter.patient_detail?.name}</div>
                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={onClose}>✕</button>
                </div>
                {loading ? (
                    <div className="loading-center"><div className="spinner" /></div>
                ) : !report ? (
                    <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No assessment data found for this encounter.</p>
                ) : (
                    <div>
                        {/* Meta */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', alignItems: 'center' }}>
                            <span>👨‍⚕️ Dr. {report.doctor_name}</span>
                            <span>🕐 Started {report.started_at ? new Date(report.started_at).toLocaleTimeString() : '—'}</span>
                            {report.completed_at && (
                                <span style={{ color: 'var(--success)' }}>
                                    ✅ Completed {new Date(report.completed_at).toLocaleString()}
                                </span>
                            )}
                        </div>

                        {/* Report */}
                        {report.report_text && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                        {isLLMReport ? '🤖 AI GENERATED SUMMARY' : '📄 STRUCTURED CLINICAL REPORT'}
                                    </div>
                                    {!isLLMReport && (
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(234,179,8,0.15)', color: 'var(--warn)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>
                                            LLM offline
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    background: 'var(--surface2)', borderRadius: 8, padding: '1rem',
                                    lineHeight: 1.75, color: 'var(--text)',
                                    whiteSpace: 'pre-wrap', marginBottom: '1rem',
                                    fontFamily: isLLMReport ? 'inherit' : 'monospace',
                                    fontSize: isLLMReport ? '0.9rem' : '0.82rem',
                                }}>
                                    {report.report_text}
                                </div>
                            </>
                        )}

                        {/* Raw notes — only show separately when LLM ran (otherwise notes are embedded in report) */}
                        {isLLMReport && report.notes && (
                            <>
                                <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}
                                    onClick={() => setShowRawNotes(v => !v)}
                                >
                                    {showRawNotes ? '▲ Hide' : '▼ Show'} Raw Doctor Notes
                                </button>
                                {showRawNotes && (
                                    <div style={{
                                        background: 'var(--surface2)', borderRadius: 8, padding: '1rem',
                                        fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--text-muted)',
                                        whiteSpace: 'pre-wrap', marginBottom: '1rem', fontFamily: 'monospace',
                                    }}>
                                        {report.notes}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Attachments */}
                        {report.media_json?.length > 0 && (
                            <>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                                    ATTACHMENTS ({report.media_json.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                    {report.media_json.map((m, i) => (
                                        m.mime_type?.startsWith('image/') ? (
                                            <img key={i} src={`data:${m.mime_type};base64,${m.data_b64}`}
                                                alt={m.name} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                                        ) : (
                                            <div key={i} style={{ padding: '0.5rem 0.75rem', background: 'var(--surface2)', borderRadius: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                📄 {m.name}
                                            </div>
                                        )
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
                <div className="modal-footer">
                    <button className="btn btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
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
    const [listening, setListening] = useState(false)

    const toggleVoice = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert('Voice input not supported in this browser.')
        if (listening) return

        const recognition = new SpeechRecognition()
        recognition.lang = 'en-IN'
        recognition.interimResults = false

        recognition.onstart = () => setListening(true)
        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript
            setForm(f => ({ ...f, raw_input_text: f.raw_input_text ? f.raw_input_text + ' ' + transcript : transcript }))
        }
        recognition.onerror = () => setListening(false)
        recognition.onend = () => setListening(false)
        recognition.start()
    }

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

            const payload = { raw_input_text: form.raw_input_text, vitals, symptoms, red_flags }

            if (!navigator.onLine) {
                await saveDraft(encounter.id, payload)
                alert("You are offline. Triage saved locally and will be synced when online.")
                onResult(null)
                onClose()
                return
            }

            const res = await TriageAPI.analyze(encounter.id, payload)
            setResult(res)
            onResult(res)
        } catch (err) {
            const errs = err.response?.data?.errors || err.message
            alert('Triage failed: ' + (typeof errs === 'object' ? JSON.stringify(errs) : errs))
        } finally {
            setLoading(false)
        }
    }

    const printSlip = () => {
        if (!result) return
        const win = window.open('', '_blank')
        if (!win) return alert('Pop-ups blocked. Please allow pop-ups to print.')
        win.document.write(`
            <html><head><title>Triage Slip - ${encounter.patient_detail?.name || 'Patient'}</title></head>
            <body style="font-family: Arial, sans-serif; padding: 2rem; color: #111;">
                <h2>Acuvera ED — Triage Slip</h2>
                <hr style="border:1px solid #ddd; margin: 1rem 0;" />
                <p><strong>Patient:</strong> ${encounter.patient_detail?.name || 'Unknown'}</p>
                <p><strong>Encounter ID:</strong> ${encounter.id}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                
                <h3 style="margin-top: 2rem;">Triage Results</h3>
                <p><strong>Priority:</strong> <span style="font-size:1.2rem; font-weight:bold; text-transform:uppercase;">${result.priority}</span></p>
                <p><strong>Risk Score:</strong> ${result.effective_score}</p>
                <p><strong>Confidence:</strong> ${result.confidence_score}%</p>

                <h4>Contributing Rules / Reasons:</h4>
                <ul style="line-height: 1.6;">
                    ${result.reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
                ${result.hard_override ? '<p style="color:red; font-weight:bold;">⚠️ HARD OVERRIDE TRIGGERED</p>' : ''}
                
                <p style="margin-top: 3rem; font-size:0.8rem; color:#666;">
                    * This is an autogenerated Acuvera decision-support slip. Not a clinical diagnosis. *
                </p>
                <script>window.print(); window.setTimeout(() => window.close(), 500);</script>
            </body></html>
        `)
        win.document.close()
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">🔬 Triage Analysis — {encounter.patient_detail?.name || 'Patient'}</div>
                    <button type="button" className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={onClose}>✕</button>
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
                            <button type="button" className="btn btn-ghost" onClick={printSlip}>🖨️ Print Slip</button>
                            <button type="button" className="btn btn-primary" onClick={onClose}>Done ✓</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Chief Complaint / Hinglish Text (optional)</span>
                                <button type="button" className="btn btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: listening ? 'var(--danger)' : 'var(--primary)', border: listening ? '1px solid var(--danger)' : '1px solid var(--primary)' }} onClick={toggleVoice}>
                                    {listening ? '🎤 Listening...' : '🎙️ Dictate'}
                                </button>
                            </label>
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
            const enc = await EncounterAPI.create({
                patient_id: patient.id,
                department_id: dept
            })
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


// ─── Doctor Assignment Modal (2-step: pick doc → enter location → confirm) ──
function DoctorAssignmentModal({ encounter, onClose, onAssigned }) {
    const [doctors, setDoctors] = useState([])
    const [loading, setLoading] = useState(true)
    const [step, setStep] = useState('pick_doctor') // 'pick_doctor' | 'enter_location'
    const [selectedDoc, setSelectedDoc] = useState(null)
    const [assigning, setAssigning] = useState(false)
    const [location, setLocation] = useState({
        floor: encounter.floor || '',
        room_number: encounter.room_number || '',
        bed_number: encounter.bed_number || ''
    })

    const isAlreadyAssigned = !!encounter.assigned_doctor
    const isAccepted = encounter.status === 'in_progress' && !!encounter.assigned_doctor
    const currentDoctorId = encounter.assigned_doctor ? String(encounter.assigned_doctor) : null

    useEffect(() => {
        AllocationAPI.candidates(encounter.id)
            .then(setDoctors)
            .catch(() => setDoctors([]))
            .finally(() => setLoading(false))
    }, [encounter.id])

    const handleSelectDoctor = (doc) => {
        if (isAccepted) return
        setSelectedDoc(doc)
        setStep('enter_location')
    }

    const handleConfirmAssign = async () => {
        if (!selectedDoc) return
        setAssigning(true)
        const isReassign = isAlreadyAssigned && String(selectedDoc.id) !== currentDoctorId
        try {
            await AllocationAPI.confirm({
                encounter_id: encounter.id,
                to_doctor_id: selectedDoc.id,
                reason: isReassign ? 'manual_nurse_reassignment' : 'manual_nurse_assignment',
                ...location
            })
            onAssigned()
            onClose()
        } catch (err) {
            alert('Assignment failed: ' + (err.response?.data?.errors || err.message))
        } finally {
            setAssigning(false)
        }
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: 500 }}>
                <div className="modal-header">
                    <div className="modal-title">
                        {step === 'pick_doctor'
                            ? <>👨‍⚕️ {isAlreadyAssigned ? 'Reassign Doctor' : 'Assign Doctor'} — {encounter.patient_detail?.name}</>
                            : <>📍 Patient Location — {encounter.patient_detail?.name}</>
                        }
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>✕</button>
                </div>

                {/* Step indicators */}
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem 0', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    <span style={{ color: step === 'pick_doctor' ? 'var(--primary)' : 'var(--success)' }}>
                        {step === 'pick_doctor' ? '● 1. Select Doctor' : '✓ 1. Doctor Selected'}
                    </span>
                    <span style={{ margin: '0 0.25rem' }}>›</span>
                    <span style={{ color: step === 'enter_location' ? 'var(--primary)' : 'var(--text-muted)' }}>
                        ● 2. Enter Location
                    </span>
                </div>

                {/* Info banner for already accepted encounters */}
                {isAccepted && (
                    <div style={{ margin: '0.75rem 1rem 0', padding: '0.6rem 0.9rem', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8, fontSize: '0.8rem', color: '#eab308' }}>
                        ⚠️ This encounter is already <strong>in progress</strong> — reassignment is disabled once a doctor has accepted.
                    </div>
                )}

                {isAlreadyAssigned && !isAccepted && (
                    <div style={{ margin: '0.75rem 1rem 0', padding: '0.6rem 0.9rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: '0.8rem', color: '#60a5fa' }}>
                        ℹ️ Patient is assigned but not yet accepted. You can reassign to a different doctor.
                    </div>
                )}

                {encounter.rejection_count > 0 && !isAlreadyAssigned && (
                    <div style={{ margin: '0.75rem 1rem 0', padding: '0.6rem 0.9rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: '0.8rem', color: '#ef4444' }}>
                        ⚠️ The previously assigned doctor rejected this patient. Please assign a new one.
                    </div>
                )}

                <div className="modal-body" style={{ padding: '1rem' }}>
                    {/* ── STEP 1: Pick Doctor ── */}
                    {step === 'pick_doctor' && (
                        loading ? (
                            <div className="loading-center" style={{ padding: '2rem' }}><div className="spinner" /></div>
                        ) : doctors.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                                No available doctors found in this department.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {doctors.map((doc, idx) => {
                                    const isCurrentDoc = currentDoctorId && String(doc.id) === currentDoctorId
                                    const isSuggested = idx === 0 && !isAlreadyAssigned && encounter.rejection_count === 0
                                    return (
                                        <div key={doc.id} style={{
                                            padding: '1rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            border: isCurrentDoc || isSuggested ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border)',
                                            background: isCurrentDoc || isSuggested ? 'rgba(34,197,94,0.07)' : 'var(--surface2)',
                                            borderRadius: 12,
                                            transition: 'all 0.15s ease',
                                        }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
                                                    Dr. {doc.full_name}
                                                    {isCurrentDoc && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '0.1rem 0.45rem', textTransform: 'uppercase' }}>
                                                            ✓ Assigned
                                                        </span>
                                                    )}
                                                    {isSuggested && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '0.1rem 0.45rem', textTransform: 'uppercase' }}>
                                                            ✦ Suggested
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                    <span title="Number of active cases (assigned + in progress + escalated). Completed cases excluded.">
                                                        Active Cases: <strong style={{ color: (doc.active_case_count ?? doc.workload_score) > 4 ? 'var(--warn)' : 'var(--success)' }}>
                                                            {doc.active_case_count ?? '—'}
                                                        </strong>
                                                    </span>
                                                    <span style={{ margin: '0 0.5rem' }}>•</span>
                                                    Status: <span className="tag" style={{ textTransform: 'capitalize' }}>{doc.availability_state}</span>
                                                </div>
                                            </div>
                                            {isCurrentDoc ? (
                                                <button
                                                    className="btn btn-ghost"
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', opacity: 0.5, cursor: 'default' }}
                                                    disabled
                                                >
                                                    Current
                                                </button>
                                            ) : (
                                                <button
                                                    className={isAlreadyAssigned ? 'btn btn-warn' : 'btn btn-primary'}
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                                    disabled={isAccepted}
                                                    onClick={() => handleSelectDoctor(doc)}
                                                >
                                                    {isAlreadyAssigned ? '⇄ Reassign' : 'Assign →'}
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    )}

                    {/* ── STEP 2: Enter Location ── */}
                    {step === 'enter_location' && selectedDoc && (
                        <div>
                            <div style={{
                                padding: '0.75rem 1rem', borderRadius: 10,
                                background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.3)',
                                marginBottom: '1.25rem', fontSize: '0.88rem',
                                display: 'flex', alignItems: 'center', gap: '0.75rem'
                            }}>
                                <span style={{ fontSize: '1.2rem' }}>👨‍⚕️</span>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#22c55e' }}>Dr. {selectedDoc.full_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                        Workload: {selectedDoc.active_case_count ?? selectedDoc.workload_score} active cases · {selectedDoc.availability_state}
                                    </div>
                                </div>
                            </div>

                            <div className="section-label" style={{ marginBottom: '0.75rem' }}>Patient Location <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>(optional – can be updated later)</span></div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Floor</label>
                                    <input
                                        value={location.floor}
                                        onChange={e => setLocation(l => ({ ...l, floor: e.target.value }))}
                                        placeholder="e.g. 2nd Floor"
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Room No</label>
                                    <input
                                        value={location.room_number}
                                        onChange={e => setLocation(l => ({ ...l, room_number: e.target.value }))}
                                        placeholder="e.g. 204"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Bed No</label>
                                    <input
                                        value={location.bed_number}
                                        onChange={e => setLocation(l => ({ ...l, bed_number: e.target.value }))}
                                        placeholder="e.g. B"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {step === 'enter_location' && (
                        <button type="button" className="btn btn-ghost" onClick={() => setStep('pick_doctor')}>← Back</button>
                    )}
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    {step === 'enter_location' && (
                        <button
                            type="button"
                            className="btn btn-success"
                            disabled={assigning}
                            onClick={handleConfirmAssign}
                        >
                            {assigning ? 'Assigning...' : '✓ Confirm Assignment'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Location Update Modal (for editing location on assigned patients) ────────
function LocationUpdateModal({ encounter, onClose, onUpdated }) {
    const [location, setLocation] = useState({
        floor: encounter.floor || '',
        room_number: encounter.room_number || '',
        bed_number: encounter.bed_number || ''
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const handleSave = async () => {
        setSaving(true); setError(null)
        try {
            await EncounterAPI.updateLocation(encounter.id, location)
            onUpdated()
            onClose()
        } catch (err) {
            setError(err.response?.data?.errors || err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: 420 }}>
                <div className="modal-header">
                    <div className="modal-title">📍 Update Patient Location</div>
                    <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>✕</button>
                </div>
                <div style={{ padding: '0.5rem 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Patient: <strong style={{ color: 'var(--text)' }}>{encounter.patient_detail?.name}</strong>
                </div>
                <div className="modal-body" style={{ padding: '1rem' }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Floor</label>
                            <input
                                value={location.floor}
                                onChange={e => setLocation(l => ({ ...l, floor: e.target.value }))}
                                placeholder="e.g. 2nd Floor"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label>Room No</label>
                            <input
                                value={location.room_number}
                                onChange={e => setLocation(l => ({ ...l, room_number: e.target.value }))}
                                placeholder="e.g. 204"
                            />
                        </div>
                        <div className="form-group">
                            <label>Bed No</label>
                            <input
                                value={location.bed_number}
                                onChange={e => setLocation(l => ({ ...l, bed_number: e.target.value }))}
                                placeholder="e.g. B"
                            />
                        </div>
                    </div>
                    {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>⚠ {error}</div>}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : '💾 Save Location'}
                    </button>
                </div>
            </div>
        </div>
    )
}



// ─── Ambulance Card ──────────────────────────────────────────
function AmbulanceCard({ enc, onExpired }) {
    const [eta, setEta] = useState(enc.eta_remaining_seconds ?? 0)

    useEffect(() => {
        if (eta <= 0) {
            // Give nurse 2 seconds to read "Arrived", then move it down
            const t = setTimeout(() => onExpired?.(enc.id), 2000)
            return () => clearTimeout(t)
        }
        const t = setInterval(() => setEta(prev => {
            if (prev <= 1) {
                clearInterval(t)
                return 0
            }
            return prev - 1
        }), 1000)
        return () => clearInterval(t)
    }, [eta <= 0]) // eslint-disable-line react-hooks/exhaustive-deps

    const mins = String(Math.floor(eta / 60)).padStart(2, '0')
    const secs = String(eta % 60).padStart(2, '0')
    const arrivingSoon = eta > 0 && eta < 120
    const arrived = eta === 0

    const borderColor = {
        critical: '#ef4444', high: '#f97316', moderate: '#eab308', low: '#22c55e'
    }[enc.priority] || '#64748b'

    const vitals = enc.triage_data?.vitals_json

    return (
        <div style={{
            border: `2px solid ${borderColor}`,
            borderRadius: 14, padding: '1rem 1.25rem',
            background: `${borderColor}0d`,
            display: 'flex', alignItems: 'center', gap: '1.25rem',
            flexWrap: 'wrap',
            animation: arrivingSoon ? 'pulse-border 1.2s ease-in-out infinite' : 'none',
        }}>
            {/* Ambulance icon + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: `${borderColor}22`, border: `1px solid ${borderColor}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem'
                }}>🚑</div>
                <span style={{
                    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.06em',
                    color: borderColor, textTransform: 'uppercase', textAlign: 'center',
                    lineHeight: 1.2, maxWidth: 64,
                }}>Pre-triaged in ambulance</span>
            </div>

            {/* Patient info */}
            <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' }}>
                    {enc.patient_detail?.name || 'Unknown Patient'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                    {enc.patient_detail?.age ? `${enc.patient_detail.age}y` : ''}
                    {enc.patient_detail?.gender ? ` · ${enc.patient_detail.gender}` : ''}
                    {enc.patient_detail?.chief_complaint ? ` · ${enc.patient_detail.chief_complaint}` : ''}
                </div>
                <div style={{ marginTop: 6 }}>
                    <span className={`badge badge-${enc.priority}`}>{enc.priority}</span>
                    {enc.risk_score > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 8 }}>Score: {enc.risk_score}</span>
                    )}
                </div>
            </div>

            {/* Vitals */}
            {vitals && (
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                    {[
                        ['HR', vitals.hr, 'bpm'],
                        ['SpO₂', vitals.spo2, '%'],
                        ['RR', vitals.rr, '/m'],
                        ['BP', vitals.bp_systolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : null, ''],
                        ['Temp', vitals.temp, '°F'],
                    ].filter(([, v]) => v != null).map(([k, v, u]) => (
                        <div key={k} style={{
                            background: 'rgba(15,23,42,0.5)', borderRadius: 6,
                            padding: '0.2rem 0.55rem', color: '#94a3b8',
                        }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>{k} </span>
                            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{v}{u}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ETA countdown */}
            <div style={{ textAlign: 'center', minWidth: 90, flexShrink: 0 }}>
                {arrived ? (
                    <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.8rem' }}>✅ Arrived<br />Moving to queue...</div>
                ) : (
                    <>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>ETA</div>
                        <div style={{
                            fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 800,
                            color: arrivingSoon ? '#f59e0b' : '#f1f5f9',
                            lineHeight: 1,
                        }}>{mins}:{secs}</div>
                        {arrivingSoon && (
                            <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700, marginTop: 3, animation: 'pulse-text 1s ease-in-out infinite' }}>
                                ⚠ Arriving Soon
                            </div>
                        )}
                    </>
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
    const [assignEnc, setAssignEnc] = useState(null)
    const [reportEnc, setReportEnc] = useState(null)
    const [locationEnc, setLocationEnc] = useState(null)
    // Track active code blues: { [encounterId]: { patientName, icuBed, triggeredAt } }
    const [activeCodeBlues, setActiveCodeBlues] = useState({})
    // Live escalation events from API (for reliable acknowledge after page refresh)
    const [liveEscalEvents, setLiveEscalEvents] = useState([])

    // Offline State
    const [offlineDrafts, setOfflineDrafts] = useState([])
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [syncing, setSyncing] = useState(false)

    const loadDrafts = useCallback(async () => {
        try {
            const drafts = await getAllDrafts()
            setOfflineDrafts(drafts)
        } catch { }
    }, [])

    const load = useCallback(async () => {
        if (!navigator.onLine) return
        try {
            const data = await EncounterAPI.list({ status: '' })
            setEncounters(Array.isArray(data) ? data : [])
        } catch { setEncounters([]) }
        finally { setLoading(false) }
    }, [])

    const loadEscalEvents = useCallback(async () => {
        try {
            const events = await EscalationAPI.events({})
            setLiveEscalEvents(Array.isArray(events) ? events : [])
        } catch { }
    }, [])

    useEffect(() => {
        load()
        loadDrafts()
        loadEscalEvents()
        const t = setInterval(() => { load(); loadEscalEvents() }, 30000)

        const onOnline = () => { setIsOnline(true); loadDrafts(); load(); loadEscalEvents() }
        const onOffline = () => setIsOnline(false)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)

        return () => {
            clearInterval(t)
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [load, loadDrafts, loadEscalEvents])

    const syncDrafts = async () => {
        if (!isOnline) { alert("Cannot sync while offline."); return }
        setSyncing(true)
        const drafts = await getAllDrafts()
        for (const draft of drafts) {
            try {
                // Silently sync triage drafts
                await TriageAPI.analyze(draft.encounterId, draft.triageData)
                await deleteDraft(draft.id)
            } catch (err) {
                console.error("Draft sync error:", err)
            }
        }
        await loadDrafts()
        await load()
        setSyncing(false)
    }

    const triggerCodeBlue = async (enc) => {
        if (!window.confirm(`Trigger CODE BLUE for ${enc.patient_detail?.name || 'this patient'}? This cannot be undone.`)) return
        try {
            const result = await EscalationAPI.trigger({ encounter_id: enc.id, type: 'code_blue' })
            const patientName = enc.patient_detail?.name || 'Unknown Patient'
            const icuBed = result?.icu_bed || 'ICU'
            setActiveCodeBlues(prev => ({
                ...prev,
                [enc.id]: {
                    patientName,
                    icuBed,
                    triggeredAt: Date.now(),
                    eventId: result?.escalation_event_id,
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    responseSeconds: null,
                }
            }))
            load()
            loadEscalEvents()
        } catch (err) { alert('Error: ' + (err.response?.data?.errors || err.message)) }
    }

    const acknowledgeCodeBlue = async (encId) => {
        try {
            // Prefer in-memory eventId, fall back to live API events
            let eventId = activeCodeBlues[encId]?.eventId
            if (!eventId) {
                const match = liveEscalEvents.find(
                    e => String(e.encounter_id) === String(encId) && !e.acknowledged_at
                )
                if (match) eventId = match.id
            }
            const payload = eventId ? eventId : { encounter_id: encId }

            const result = await EscalationAPI.acknowledge(payload)
            setActiveCodeBlues(prev => ({
                ...prev,
                [encId]: {
                    ...(prev[encId] || {}),
                    acknowledged: true,
                    acknowledgedBy: result?.acknowledged_by,
                    acknowledgedAt: result?.acknowledged_at,
                    responseSeconds: result?.response_time_seconds,
                }
            }))
            loadEscalEvents()
        } catch (err) {
            const rawMsg = err.response?.data?.errors || err.message
            // Backend sometimes returns array e.g. ["Already acknowledged..."]
            const msgStr = Array.isArray(rawMsg) ? rawMsg.join(', ') : (typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg))
            if (msgStr.includes('Already acknowledged') || msgStr.includes('no active code blue')) {
                // Treat as already-done — mark acknowledged locally and refresh
                setActiveCodeBlues(prev => ({ ...prev, [encId]: { ...(prev[encId] || {}), acknowledged: true } }))
                loadEscalEvents()
            } else {
                alert('Error: ' + msgStr)
            }
        }
    }

    const suggestAndAssign = (enc) => setAssignEnc(enc)

    // Reassign for starving patients — same logic but labels as "reassign"
    const reassign = (enc) => setAssignEnc(enc)

    // Split encounters
    const incomingAmbulances = encounters.filter(e => e.status === 'incoming')
    const activeQueue = encounters.filter(e => e.status !== 'incoming')

    // Status filter
    const [statusFilter, setStatusFilter] = useState('all')

    // Compute starvation threshold per encounter
    const isStarving = (enc) => {
        if (['completed', 'cancelled'].includes(enc.status)) return false
        const waitMins = (Date.now() - new Date(enc.created_at)) / 60000
        return waitMins > 30
    }

    if (loading) return <div className="loading-center"><div className="spinner" /><span>Loading queue...</span></div>

    // Derive active code blues from encounter status too (survives refresh)
    const escalatedEncounters = activeQueue.filter(e => e.status === 'escalated')
    const rejectedEncounters = activeQueue.filter(e => e.rejection_count > 0 && !e.assigned_doctor_detail)

    // Apply status filter
    const filteredQueue = statusFilter === 'all' ? activeQueue : activeQueue.filter(e => e.status === statusFilter)

    const STATUS_FILTERS = [
        { value: 'all', label: 'All', count: activeQueue.length },
        { value: 'waiting', label: 'Waiting', count: activeQueue.filter(e => e.status === 'waiting').length },
        { value: 'assigned', label: 'Assigned', count: activeQueue.filter(e => e.status === 'assigned').length },
        { value: 'in_progress', label: 'In Progress', count: activeQueue.filter(e => e.status === 'in_progress').length },
        { value: 'escalated', label: 'Escalated', count: activeQueue.filter(e => e.status === 'escalated').length },
        { value: 'completed', label: 'Completed', count: activeQueue.filter(e => e.status === 'completed').length },
        { value: 'cancelled', label: 'Cancelled', count: activeQueue.filter(e => e.status === 'cancelled').length },
    ].filter(f => f.value === 'all' || f.count > 0)

    return (
        <div>
            {!isOnline && (
                <div style={{ background: 'var(--warn)', color: '#000', padding: '0.4rem', textAlign: 'center', fontWeight: 600, fontSize: '0.8rem', borderRadius: 8, marginBottom: '1rem' }}>
                    ⚠️ You are currently offline. New triage sessions will be cached locally.
                </div>
            )}

            {/* ─── Doctor Rejection Alerts ─── */}
            {rejectedEncounters.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {rejectedEncounters.map(enc => (
                        <div key={enc.id} style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid #ef4444',
                            borderRadius: 10,
                            padding: '0.7rem 1.25rem',
                            display: 'flex', alignItems: 'center', gap: '1rem',
                        }}>
                            <span style={{ fontSize: '1rem' }}>⚠️</span>
                            <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '0.85rem', letterSpacing: '0.08em' }}>DOCTOR REJECTED CASE</span>
                                <span style={{ color: '#f1f5f9', marginLeft: 10, fontWeight: 600 }}>{enc.patient_detail?.name || 'Unknown Patient'}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 10 }}>Requires manual reassignment</span>
                            </div>
                            <button className="btn btn-danger" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => suggestAndAssign(enc)}>
                                Reassign Now
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── CODE BLUE Active Banners ─── */}
            {escalatedEncounters.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                    {escalatedEncounters.map(enc => {
                        const cb = activeCodeBlues[enc.id]
                        const patientName = cb?.patientName || enc.patient_detail?.name || 'Unknown Patient'
                        const icuBed = cb?.icuBed || 'ICU'
                        const location = [enc.floor && `Floor ${enc.floor}`, enc.room_number && `Room ${enc.room_number}`].filter(Boolean).join(' · ') || null
                        // isAcknowledged: check in-memory state first, then fall back to live API events
                        const hasLiveUnacked = liveEscalEvents.some(
                            e => String(e.encounter_id) === String(enc.id) && !e.acknowledged_at && e.type === 'code_blue'
                        )
                        const hasLiveAcked = liveEscalEvents.some(
                            e => String(e.encounter_id) === String(enc.id) && e.type === 'code_blue'
                        )
                        const isAcknowledged = cb?.acknowledged || (hasLiveAcked && !hasLiveUnacked)

                        // Per user request: if acknowledged, it should completely disappear from the active alerts banner
                        if (isAcknowledged) return null

                        return (
                            <div key={enc.id} style={{
                                background: isAcknowledged ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.12)',
                                border: `2px solid ${isAcknowledged ? '#22c55e' : '#ef4444'}`,
                                borderLeft: `6px solid ${isAcknowledged ? '#22c55e' : '#ef4444'}`,
                                borderRadius: 10,
                                padding: '0.85rem 1.25rem',
                                display: 'flex', alignItems: 'center', gap: '1rem',
                                animation: isAcknowledged ? 'none' : 'codeblue-pulse 1s ease-in-out infinite',
                                transition: 'all 0.4s ease',
                            }}>
                                <span style={{ fontSize: '1.4rem' }}>{isAcknowledged ? '✅' : '�'}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 900, color: isAcknowledged ? '#22c55e' : '#ef4444', fontSize: '0.9rem', letterSpacing: '0.1em' }}>
                                            {isAcknowledged ? '✔ CODE BLUE — ACKNOWLEDGED' : '🚨 CODE BLUE ACTIVE'}
                                        </span>
                                        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem' }}>{patientName}</span>
                                        {location && <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>📍 {location}</span>}
                                    </div>
                                    {isAcknowledged ? (() => {
                                        const ackName = cb?.acknowledgedBy || liveEscalEvents.find(e => String(e.encounter_id) === String(enc.id) && e.acknowledged_at)?.acknowledged_by_name || 'Nurse'
                                        const ackTime = cb?.responseSeconds ?? liveEscalEvents.find(e => String(e.encounter_id) === String(enc.id) && e.acknowledged_at)?.response_time_seconds
                                        return (
                                            <div style={{ fontSize: '0.8rem', color: '#86efac', marginTop: '0.3rem', fontWeight: 600 }}>
                                                Acknowledged by {ackName}
                                                {ackTime != null && ` · Response time: ${ackTime}s`}
                                            </div>
                                        )
                                    })() : (
                                        <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: '0.25rem', fontWeight: 600 }}>
                                            Resuscitation protocol initiated · 🏥 {icuBed} · Requires nurse acknowledgement
                                        </div>
                                    )}
                                </div>
                                {!isAcknowledged ? (
                                    <button
                                        className="btn btn-danger"
                                        style={{ fontWeight: 800, fontSize: '0.85rem', padding: '0.55rem 1.1rem', position: 'relative', zIndex: 10 }}
                                        onClick={() => acknowledgeCodeBlue(enc.id)}
                                    >
                                        ✓ ACKNOWLEDGE
                                    </button>
                                ) : (
                                    <div style={{
                                        background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                                        borderRadius: 8, padding: '0.4rem 0.9rem',
                                        fontWeight: 800, fontSize: '0.78rem', color: '#4ade80'
                                    }}>
                                        RESPONDED
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="page-header">
                <div>
                    <div className="page-title">🚨 Active Queue</div>
                    <div className="page-subtitle">{activeQueue.length} active · {incomingAmbulances.length} en route — auto-refreshes every 30s</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {offlineDrafts.length > 0 && (
                        <button className="btn btn-warn" onClick={syncDrafts} disabled={syncing || !isOnline}>
                            {syncing ? 'Syncing...' : `⚠️ Sync ${offlineDrafts.length} Offline Drafts`}
                        </button>
                    )}
                    <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
                    <button className="btn btn-primary" onClick={() => setShowNewPatient(true)}>+ New Patient</button>
                </div>
            </div>

            {/* ─── Status Filter Tabs ─── */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value)}
                        style={{
                            padding: '0.3rem 0.75rem',
                            borderRadius: 20,
                            border: statusFilter === f.value ? '1px solid rgba(59,130,246,0.6)' : '1px solid var(--border)',
                            background: statusFilter === f.value ? 'rgba(59,130,246,0.15)' : 'transparent',
                            color: statusFilter === f.value ? '#60a5fa' : 'var(--text-muted)',
                            fontWeight: statusFilter === f.value ? 700 : 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                        }}
                    >
                        {f.label}
                        <span style={{
                            background: statusFilter === f.value ? 'rgba(59,130,246,0.25)' : 'var(--surface2)',
                            borderRadius: 10, padding: '0.05rem 0.4rem',
                            fontSize: '0.7rem', fontWeight: 700,
                        }}>{f.count}</span>
                    </button>
                ))}
            </div>

            {/* ─── Incoming Ambulances Section ─── */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    marginBottom: '0.75rem',
                }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>🚑 Incoming Ambulances</span>
                    {incomingAmbulances.length > 0 && (
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 800, background: 'rgba(239,68,68,0.15)',
                            color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 20, padding: '0.15rem 0.55rem', textTransform: 'uppercase', letterSpacing: '0.07em'
                        }}>{incomingAmbulances.length} en route</span>
                    )}
                </div>
                {incomingAmbulances.length === 0 ? (
                    <div style={{
                        padding: '0.75rem 1rem', borderRadius: 10,
                        border: '1px dashed rgba(51,65,85,0.6)',
                        color: '#475569', fontSize: '0.8rem', fontWeight: 500,
                    }}>None</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {incomingAmbulances.map(enc => (
                            <AmbulanceCard key={enc.id} enc={enc} onExpired={(id) => {
                                setEncounters(prev => prev.map(e =>
                                    e.id === id ? { ...e, status: 'waiting' } : e
                                ))
                            }} />
                        ))}
                    </div>
                )}
            </div>

            {filteredQueue.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">🏥</div><p>No {statusFilter === 'all' ? 'active' : statusFilter.replace('_', ' ')} encounters</p></div>
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
                            {filteredQueue.map(enc => (
                                <tr key={enc.id} className={`row-${enc.priority}`} style={enc.status === 'escalated' ? {
                                    borderLeft: '4px solid #ef4444',
                                    background: 'rgba(239,68,68,0.05)',
                                } : enc.status === 'completed' ? {
                                    opacity: 0.7,
                                } : {}}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{enc.patient_detail?.name || '—'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {enc.patient_detail?.age ? `${enc.patient_detail.age}y` : ''} {enc.patient_detail?.gender || ''}
                                        </div>
                                        {enc.status === 'escalated' && (
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem', letterSpacing: '0.05em' }}>
                                                🚨 CODE BLUE ACTIVE
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                            <span style={{ fontWeight: 600, color: enc.triage_data ? 'var(--text)' : 'var(--text-muted)' }}>
                                                {waitLabel(enc.created_at, ['completed', 'cancelled'].includes(enc.status) ? enc.updated_at : null)}
                                            </span>
                                            {isStarving(enc) && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--warn)', fontWeight: 700 }}>⚠️ Too long</span>
                                            )}
                                        </div>
                                    </td>
                                    <td><PriorityBadge priority={enc.priority} /></td>
                                    <td style={{ fontWeight: 600 }}>{enc.risk_score}</td>
                                    <td>
                                        {enc.confidence_score != null ? (() => {
                                            const s = enc.confidence_score
                                            const color = s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : s >= 40 ? '#f97316' : '#ef4444'
                                            const label = s >= 80 ? 'High' : s >= 60 ? 'Moderate' : s >= 40 ? 'Low' : 'Very Low'
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ background: 'var(--surface2)', borderRadius: 4, height: 6, width: 64, overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: 4,
                                                            width: `${s}%`,
                                                            background: `linear-gradient(90deg, ${color}99, ${color})`,
                                                            boxShadow: `0 0 6px ${color}66`,
                                                            transition: 'width 0.4s ease',
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color }} title={label}>{s}%</span>
                                                </div>
                                            )
                                        })() : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td style={{ color: enc.assigned_doctor_detail ? 'var(--text)' : 'var(--text-muted)' }}>
                                        {enc.assigned_doctor_detail?.full_name || 'Unassigned'}
                                    </td>
                                    <td><span className="tag">{enc.status.replace('_', ' ')}</span></td>
                                    <td>
                                        {/* ── COMPLETED: Report only ── */}
                                        {enc.status === 'completed' ? (
                                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                {enc.assessment_completed ? (
                                                    <button className="btn btn-indigo" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => setReportEnc(enc)}>
                                                        <FileText size={14} /> Report
                                                    </button>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                                                )}
                                            </div>

                                            /* ── ESCALATED (Code Blue) ── */
                                        ) : enc.status === 'escalated' ? (
                                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                {enc.assessment_completed && (
                                                    <button className="btn btn-indigo" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => setReportEnc(enc)}>
                                                        <FileText size={14} /> Report
                                                    </button>
                                                )}
                                                {enc.assigned_doctor_detail && (
                                                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => setLocationEnc(enc)}>
                                                        📍 Location
                                                    </button>
                                                )}
                                                <span style={{
                                                    padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 800,
                                                    color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)',
                                                    borderRadius: 6, background: 'rgba(239,68,68,0.1)',
                                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                }}>
                                                    🚨 Code Blue Active
                                                </span>
                                            </div>

                                            /* ── IN PROGRESS: no Triage, no Code Blue ── */
                                        ) : enc.status === 'in_progress' ? (
                                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                {isStarving(enc) && (
                                                    <button className="btn btn-warn" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => reassign(enc)}>
                                                        <UserCog size={14} /> Reassign
                                                    </button>
                                                )}
                                                {enc.assessment_completed && (
                                                    <button className="btn btn-indigo" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => setReportEnc(enc)}>
                                                        <FileText size={14} /> Report
                                                    </button>
                                                )}
                                                {enc.assigned_doctor_detail && (
                                                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => setLocationEnc(enc)}>
                                                        📍 Location
                                                    </button>
                                                )}
                                            </div>

                                            /* ── WAITING / ASSIGNED: full actions ── */
                                        ) : (
                                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                    onClick={() => setTriageEnc(enc)}>
                                                    <Stethoscope size={14} /> Triage
                                                </button>
                                                {!enc.assigned_doctor_detail ? (
                                                    <button className={enc.rejection_count > 0 ? 'btn btn-danger' : 'btn btn-success'}
                                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => suggestAndAssign(enc)}>
                                                        <UserPlus size={14} /> {enc.rejection_count > 0 ? 'Doc Rejected — Reassign' : 'Assign'}
                                                    </button>
                                                ) : (
                                                    <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => setLocationEnc(enc)}>
                                                        📍 Location
                                                    </button>
                                                )}
                                                {enc.assessment_completed && (
                                                    <button className="btn btn-indigo" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => setReportEnc(enc)}>
                                                        <FileText size={14} /> Report
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-blue"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                    onClick={() => triggerCodeBlue(enc)}>
                                                    <AlertTriangle size={14} /> Code Blue
                                                </button>
                                            </div>
                                        )}
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
                <TriageModal
                    key={`triage-${triageEnc.id}`}
                    encounter={triageEnc}
                    onClose={() => setTriageEnc(null)}
                    onResult={() => { setTimeout(load, 1000) }}
                />
            )}
            {assignEnc && (
                <DoctorAssignmentModal
                    encounter={assignEnc}
                    onClose={() => setAssignEnc(null)}
                    onAssigned={load}
                />
            )}
            {reportEnc && (
                <ReportModal encounter={reportEnc} onClose={() => setReportEnc(null)} />
            )}
            {locationEnc && (
                <LocationUpdateModal
                    encounter={locationEnc}
                    onClose={() => setLocationEnc(null)}
                    onUpdated={load}
                />
            )}
        </div>
    )
}

// ─── Escalations Page ─────────────────────────────────────────
function EscalationsPage() {
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        try {
            const data = await EscalationAPI.events({})
            setEvents(Array.isArray(data) ? data : [])
        } catch { setEvents([]) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        load()
        const t = setInterval(load, 30000)
        return () => clearInterval(t)
    }, [load])

    const handleAcknowledge = async (eventId) => {
        try {
            await EscalationAPI.acknowledge(eventId)
            load()
        } catch (e) {
            const msg = e.response?.data?.errors || e.message
            if (String(msg).includes('Already acknowledged')) load()
            else alert('Error: ' + msg)
        }
    }

    const typeLabel = {
        code_blue: { label: '🔵 Code Blue', color: '#ef4444' },
        trauma_override: { label: '🚨 Trauma Override', color: '#f97316' },
        manual_escalation: { label: '⚠️ Manual Escalation', color: '#eab308' },
    }

    const pending = events.filter(e => !e.acknowledged_at)
    const resolved = events.filter(e => !!e.acknowledged_at)

    if (loading) return <div className="loading-center"><div className="spinner" /><span>Loading escalations...</span></div>

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">🚨 Escalations</div>
                    <div className="page-subtitle">{pending.length} active · {resolved.length} resolved — auto-refreshes every 30s</div>
                </div>
                <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
            </div>

            {/* Active Escalations */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Active Escalations ({pending.length})
                </div>
                {pending.length === 0 ? (
                    <div style={{ padding: '1.5rem', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, color: '#4ade80', fontSize: '0.9rem', fontWeight: 600 }}>
                        ✅ No active escalations
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {pending.map(ev => {
                            const tc = typeLabel[ev.type] || { label: '🚨 Escalation', color: '#ef4444' }
                            const secs = Math.floor((Date.now() - new Date(ev.timestamp)) / 1000)
                            const mins = Math.floor(secs / 60)
                            const s = secs % 60
                            return (
                                <div key={ev.id} style={{
                                    background: 'rgba(239,68,68,0.08)',
                                    border: `2px solid ${tc.color}`,
                                    borderLeft: `6px solid ${tc.color}`,
                                    borderRadius: 10,
                                    padding: '0.9rem 1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                    flexWrap: 'wrap',
                                    animation: 'codeblue-pulse 1.5s ease-in-out infinite',
                                }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                                            <span style={{ fontWeight: 900, color: tc.color, fontSize: '0.85rem', letterSpacing: '0.07em' }}>{tc.label}</span>
                                            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{ev.patient_name || `Encounter #${ev.encounter_id}`}</span>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                            ⏱ {mins}:{String(s).padStart(2, '0')} ago
                                            {ev.triggered_by_name && <span style={{ marginLeft: '0.75rem' }}>· Triggered by {ev.triggered_by_name}</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAcknowledge(ev.id)}
                                        title="Mark this escalation as acknowledged"
                                        style={{
                                            padding: '0.45rem 1rem', borderRadius: 6,
                                            background: tc.color, border: 'none',
                                            fontSize: '0.78rem', fontWeight: 800, color: '#fff',
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            boxShadow: `0 2px 8px ${tc.color}40`,
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        ✓ ACKNOWLEDGE
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Resolved Escalations */}
            <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Resolved Escalations ({resolved.length})
                </div>
                {resolved.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No resolved escalations yet.</div>
                ) : (
                    <div className="table-wrap card">
                        <table>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Patient / Encounter</th>
                                    <th>Triggered</th>
                                    <th>Acknowledged By</th>
                                    <th>Response Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resolved.map(ev => {
                                    const tc = typeLabel[ev.type] || { label: '🚨 Escalation', color: '#64748b' }
                                    const respSecs = ev.response_time_seconds
                                    const respStr = respSecs != null
                                        ? (respSecs < 60 ? `${respSecs}s` : `${Math.floor(respSecs / 60)}m ${respSecs % 60}s`)
                                        : '—'
                                    return (
                                        <tr key={ev.id}>
                                            <td>
                                                <span style={{ fontWeight: 700, color: tc.color, fontSize: '0.82rem' }}>{tc.label}</span>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{ev.patient_name || `#${ev.encounter_id}`}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(ev.timestamp).toLocaleString()}
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>{ev.acknowledged_by_name || '—'}</td>
                                            <td>
                                                <span style={{
                                                    fontWeight: 700, fontSize: '0.82rem',
                                                    color: respSecs != null && respSecs > 120 ? 'var(--warn)' : 'var(--success)'
                                                }}>{respStr}</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
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
                <Route path="escalations" element={<EscalationsPage />} />
            </Routes>
        </Shell>
    )
}
