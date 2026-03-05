import React, { useState } from 'react'
import { AmbulanceAPI } from '../api/client'
import { Ambulance, Clock, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'

const VITALS_FIELDS = [
    { key: 'hr', label: 'Heart Rate', unit: 'bpm', placeholder: '72' },
    { key: 'spo2', label: 'SpO₂', unit: '%', placeholder: '98' },
    { key: 'bp_systolic', label: 'BP Systolic', unit: 'mmHg', placeholder: '120' },
    { key: 'bp_diastolic', label: 'BP Diastolic', unit: 'mmHg', placeholder: '80' },
    { key: 'rr', label: 'Resp. Rate', unit: '/min', placeholder: '16' },
    { key: 'temp', label: 'Temperature', unit: '°F', placeholder: '98.6' },
    { key: 'gcs', label: 'GCS', unit: '/15', placeholder: '15' },
    { key: 'pain_score', label: 'Pain Score', unit: '/10', placeholder: '5' },
]

const SYMPTOM_OPTIONS = [
    'chest_pain', 'shortness_of_breath', 'trauma', 'stroke_symptoms',
    'seizure', 'syncope', 'altered_mental_status', 'severe_abdominal_pain',
    'sweating', 'severe_headache',
]

export default function ParamedicPage() {
    const [form, setForm] = useState({
        patient_name: '',
        age: '',
        gender: 'unknown',
        chief_complaint: '',
        eta_minutes: '5',
        vitals: {},
        symptoms: [],
        red_flags: {},
    })
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    const setVital = (key, val) => {
        const num = parseFloat(val)
        setForm(f => ({
            ...f,
            vitals: { ...f.vitals, [key]: isNaN(num) ? undefined : num }
        }))
    }

    const toggleSymptom = (s) => {
        setForm(f => ({
            ...f,
            symptoms: f.symptoms.includes(s)
                ? f.symptoms.filter(x => x !== s)
                : [...f.symptoms, s]
        }))
    }

    const submit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const payload = {
                ...form,
                age: parseInt(form.age) || undefined,
                eta_minutes: parseInt(form.eta_minutes) || 5,
                vitals: Object.fromEntries(
                    Object.entries(form.vitals).filter(([, v]) => v !== undefined)
                )
            }
            const data = await AmbulanceAPI.preRegister(payload)
            setResult(data)
        } catch (e) {
            setError(e.response?.data?.message || 'Submission failed. Check your connection.')
        } finally {
            setLoading(false)
        }
    }

    if (result) {
        return (
            <div style={{
                minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
                fontFamily: "'Inter', sans-serif",
            }}>
                <div style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '1.5rem', padding: '3rem', maxWidth: '500px', width: '100%',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚑</div>
                    <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ color: '#f1f5f9', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                        Patient Pre-Registered
                    </h2>
                    <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{result.message}</p>
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem'
                    }}>
                        <div style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            PATIENT ALERT — INCOMING IN
                        </div>
                        <div style={{ color: '#f1f5f9', fontSize: '3rem', fontWeight: 800 }}>
                            {result.eta_minutes} min
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            Dept: {result.department}
                        </div>
                    </div>
                    <button
                        onClick={() => { setResult(null); setForm({ patient_name: '', age: '', gender: 'unknown', chief_complaint: '', eta_minutes: '5', vitals: {}, symptoms: [], red_flags: {} }) }}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
                            color: '#fff', padding: '0.75rem 2rem', borderRadius: '0.75rem',
                            cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem'
                        }}>
                        Register Another Patient
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)',
            fontFamily: "'Inter', sans-serif", color: '#f1f5f9',
        }}>
            {/* Header */}
            <div style={{
                background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.3)',
                padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem',
            }}>
                <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Ambulance size={22} color="#ef4444" />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
                        🚑 Ambulance Pre-Triage
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                        Acuvera Paramedic Portal — register patient en route
                    </p>
                </div>
                <div style={{
                    marginLeft: 'auto', background: 'rgba(239,68,68,0.2)',
                    border: '1px solid rgba(239,68,68,0.4)', borderRadius: '0.5rem',
                    padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>LIVE</span>
                </div>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
                <form onSubmit={submit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Patient Info */}
                        <div style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.5rem', gridColumn: '1 / -1'
                        }}>
                            <h3 style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Patient Information
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem' }}>Name (if known)</label>
                                    <input value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))}
                                        placeholder="Unknown"
                                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem' }}>Age</label>
                                    <input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                                        placeholder="65" min={1} max={120}
                                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem' }}>Gender</label>
                                    <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }}>
                                        <option value="unknown">Unknown</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem' }}>ETA (minutes) *</label>
                                    <input type="number" value={form.eta_minutes} onChange={e => setForm(f => ({ ...f, eta_minutes: e.target.value }))}
                                        required min={1} max={120}
                                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.4rem' }}>Chief Complaint / Notes</label>
                                <input value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                                    placeholder="e.g. 65M chest pain 30min, diaphoresis, BP 90/60"
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        {/* Vitals */}
                        <div style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.5rem',
                        }}>
                            <h3 style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Vitals
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {VITALS_FIELDS.map(f => (
                                    <div key={f.key}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.3rem' }}>{f.label} <span style={{ color: '#64748b' }}>({f.unit})</span></label>
                                        <input type="number" step="any" placeholder={f.placeholder}
                                            onChange={e => setVital(f.key, e.target.value)}
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', color: '#f1f5f9', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Symptoms */}
                        <div style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.25rem', padding: '1.5rem',
                        }}>
                            <h3 style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Symptoms
                            </h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {SYMPTOM_OPTIONS.map(s => {
                                    const active = form.symptoms.includes(s)
                                    return (
                                        <button key={s} type="button" onClick={() => toggleSymptom(s)}
                                            style={{
                                                padding: '0.4rem 0.8rem', borderRadius: '2rem', fontSize: '0.78rem', fontWeight: 600,
                                                border: active ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.12)',
                                                background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                                                color: active ? '#818cf8' : '#94a3b8', cursor: 'pointer', transition: 'all 0.15s'
                                            }}>
                                            {s.replace(/_/g, ' ')}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Red Flags */}
                            <div style={{ marginTop: '1.25rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Red Flags</div>
                                {['cardiac_arrest', 'no_pulse', 'severe_hemorrhage', 'airway_compromised'].map(flag => (
                                    <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={!!form.red_flags[flag]} onChange={e => setForm(f => ({ ...f, red_flags: { ...f.red_flags, [flag]: e.target.checked } }))}
                                            style={{ accentColor: '#ef4444', width: 16, height: 16 }} />
                                        <span style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: 600 }}>
                                            ⚠️ {flag.replace(/_/g, ' ').toUpperCase()}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            marginTop: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '0.75rem', padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}>
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading} style={{
                        marginTop: '1.5rem', width: '100%',
                        background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                        border: 'none', color: '#fff', padding: '1rem', borderRadius: '0.75rem',
                        cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'all 0.2s',
                    }}>
                        {loading ? (
                            <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Registering Patient...</>
                        ) : (
                            <><Ambulance size={18} /> Alert Hospital — Patient En Route <ChevronRight size={18} /></>
                        )}
                    </button>
                </form>

                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#475569' }}>
                    🔒 Secured with ambulance authorization key · Acuvera Emergency Network
                </div>
            </div>
        </div>
    )
}
