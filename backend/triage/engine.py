"""
Acuvera Triage Engine — fully deterministic, no LLM influence.
See SPEC.md §6.A for the exact algorithm specification.
"""
import logging
import math
from datetime import timezone
from typing import Optional

from django.db import transaction
from django.utils import timezone as dj_tz

from core.audit import log_audit, model_snapshot

logger = logging.getLogger("acuvera.triage.engine")

# -------------------------------------------------------------------
# Constants (configurable via department.priority_weight_config)
# -------------------------------------------------------------------
MAX_RISK_SCORE = 999
DEFAULT_CRITICAL_GCS = 8
DEFAULT_CRITICAL_SPO2 = 85
DEFAULT_AGING_MINUTES_UNIT = 10
DEFAULT_AGING_POINT_UNIT = 5
DEFAULT_MIN_COMPLETE_RATIO = 0.6
DEFAULT_LOW_COMPLETENESS_PENALTY = 10

# Required vitals fields for completeness calculation
REQUIRED_VITALS = ["hr", "spo2"]
REQUIRED_SYMPTOMS = True  # at least one symptom required for full completeness


def _required_fields_present(vitals: dict, symptoms: list) -> int:
    """Count how many of the required fields are present (non-null)."""
    total_required = len(REQUIRED_VITALS) + 1  # +1 for symptoms
    present = 0
    for field in REQUIRED_VITALS:
        if vitals.get(field) is not None:
            present += 1
    # Optional additional vitals add to completeness
    optional_vitals = ["bp_systolic", "bp_diastolic", "temp", "rr", "gcs", "pain_score"]
    total_required += len(optional_vitals)
    for field in optional_vitals:
        if vitals.get(field) is not None:
            present += 1
    if symptoms:
        present += 1
    return present, total_required


def compute_completeness(vitals: dict, symptoms: list) -> float:
    """Return a ratio 0.0–1.0 of how complete the triage data is."""
    vitals = vitals or {}
    symptoms = symptoms or []
    present, total = _required_fields_present(vitals, symptoms)
    return min(1.0, present / total if total > 0 else 0.0)


def _check_hard_overrides(red_flags: dict, vitals: dict, dept_config: dict) -> Optional[str]:
    """
    Return the override reason if a hard override applies, else None.
    Hard overrides immediately set priority to critical, score to MAX.
    """
    red_flags = red_flags or {}
    vitals = vitals or {}

    if red_flags.get("cardiac_arrest"):
        return "Hard override: cardiac arrest flag"
    if red_flags.get("no_pulse"):
        return "Hard override: no pulse detected"
    if red_flags.get("severe_hemorrhage"):
        return "Hard override: severe hemorrhage (active external bleeding)"
    if red_flags.get("airway_compromised"):
        return "Hard override: airway compromised"

    critical_gcs = dept_config.get("critical_gcs_threshold", DEFAULT_CRITICAL_GCS)
    gcs = vitals.get("gcs")
    if gcs is not None and gcs <= critical_gcs:
        return f"Hard override: GCS {gcs} ≤ threshold ({critical_gcs})"

    critical_spo2 = dept_config.get("critical_spo2_threshold", DEFAULT_CRITICAL_SPO2)
    spo2 = vitals.get("spo2")
    if spo2 is not None and spo2 < critical_spo2:
        return f"Hard override: SpO2 {spo2}% < critical threshold ({critical_spo2}%)"

    return None


def _evaluate_weighted_conditions(vitals: dict, symptoms: list, patient_age: Optional[int], dept_config: dict) -> tuple:
    """
    Evaluate all configured weight conditions. Returns (score, reasons_list).
    """
    vitals = vitals or {}
    symptoms = symptoms or []
    score = 0
    reasons = []

    # SpO2 low
    spo2_threshold = dept_config.get("SpO2_low_threshold", 90)
    spo2_weight = dept_config.get("SpO2_low", 20)
    if vitals.get("spo2") is not None and vitals["spo2"] < spo2_threshold:
        score += spo2_weight
        reasons.append(f"SpO2 below threshold ({vitals['spo2']}% < {spo2_threshold}%)")

    # Heart rate high
    hr_threshold = dept_config.get("HR_high_threshold", 120)
    hr_weight = dept_config.get("HR_high", 15)
    if vitals.get("hr") is not None and vitals["hr"] > hr_threshold:
        score += hr_weight
        reasons.append(f"HR elevated ({vitals['hr']} > {hr_threshold} bpm)")

    # Heart rate low (bradycardia)
    hr_low_threshold = dept_config.get("HR_low_threshold", 50)
    hr_low_weight = dept_config.get("HR_low", 15)
    if vitals.get("hr") is not None and vitals["hr"] < hr_low_threshold:
        score += hr_low_weight
        reasons.append(f"HR critically low ({vitals['hr']} < {hr_low_threshold} bpm)")

    # Hypertension
    bp_high_threshold = dept_config.get("BP_high_threshold", 180)
    bp_weight = dept_config.get("BP_high", 10)
    if vitals.get("bp_systolic") is not None and vitals["bp_systolic"] >= bp_high_threshold:
        score += bp_weight
        reasons.append(f"BP severely elevated ({vitals['bp_systolic']}/{vitals.get('bp_diastolic', '?')} mmHg)")

    # Severe pain
    pain_threshold = dept_config.get("pain_threshold", 8)
    pain_weight = dept_config.get("severe_pain", 10)
    if vitals.get("pain_score") is not None and vitals["pain_score"] >= pain_threshold:
        score += pain_weight
        reasons.append(f"Severe pain reported (score {vitals['pain_score']}/10)")

    # Respiratory rate high
    rr_threshold = dept_config.get("RR_high_threshold", 25)
    rr_weight = dept_config.get("RR_high", 10)
    if vitals.get("rr") is not None and vitals["rr"] > rr_threshold:
        score += rr_weight
        reasons.append(f"Respiratory rate high ({vitals['rr']} > {rr_threshold} /min)")

    # Fever
    temp_threshold = dept_config.get("temp_high_threshold", 103.0)
    temp_weight = dept_config.get("temp_high", 8)
    if vitals.get("temp") is not None and vitals["temp"] >= temp_threshold:
        score += temp_weight
        reasons.append(f"High fever ({vitals['temp']}°F)")

    # Age > 60 (higher risk)
    age_weight = dept_config.get("age_over_60", 5)
    if patient_age is not None and patient_age >= 60:
        score += age_weight
        reasons.append(f"Age ≥ 60 (risk factor: {patient_age} years)")

    # Symptom-based weights
    symptom_weights = {
        "chest_pain": ("chest_pain", 20, "Chest pain reported"),
        "sweating": ("sweating", 5, "Diaphoresis/sweating reported"),
        "syncope": ("syncope", 15, "Syncope/fainting reported"),
        "altered_mental_status": ("altered_mental_status", 15, "Altered mental status"),
        "severe_headache": ("severe_headache", 10, "Severe headache"),
        "shortness_of_breath": ("shortness_of_breath", 15, "Shortness of breath"),
        "seizure": ("seizure", 15, "Seizure reported"),
        "stroke_symptoms": ("stroke_symptoms", 20, "Stroke symptoms reported"),
        "severe_abdominal_pain": ("severe_abdominal_pain", 10, "Severe abdominal pain"),
        "trauma": ("trauma", 15, "Significant trauma"),
    }
    symptoms_lower = [s.lower().replace(" ", "_") for s in symptoms]
    for key, (symptom_key, default_weight, label) in symptom_weights.items():
        weight = dept_config.get(f"symptom_{key}", default_weight)
        if symptom_key in symptoms_lower:
            score += weight
            reasons.append(label)

    return score, reasons


def _map_score_to_priority(score: int) -> str:
    if score >= 71:
        return "critical"
    elif score >= 41:
        return "high"
    elif score >= 21:
        return "moderate"
    else:
        return "low"


def compute_triage(encounter_id: str, vitals: dict, symptoms: list, red_flags: dict,
                   patient_age: Optional[int] = None, request=None) -> dict:
    """
    Main entry point for the triage engine.
    Atomic transaction with SELECT FOR UPDATE — prevents concurrent analyze calls.

    Returns a dict with: priority, risk_score, effective_score, confidence_score, reasons.
    """
    from core.models import Encounter, TriageData

    with transaction.atomic():
        enc = Encounter.objects.select_for_update().get(pk=encounter_id)
        dept_config = enc.department.priority_weight_config or {}

        # Step 1: Completeness
        completeness = compute_completeness(vitals, symptoms)

        # Step 2: Hard overrides
        override_reason = _check_hard_overrides(red_flags, vitals, dept_config)
        if override_reason:
            confidence = min(100, int(80 + completeness * 20))
            pre = model_snapshot(enc)
            enc.priority = "critical"
            enc.risk_score = MAX_RISK_SCORE
            enc.confidence_score = confidence
            enc.version += 1
            enc.save()

            _upsert_triage_data(enc, vitals, symptoms, red_flags, completeness)

            log_audit("triage.analyze", "encounter", enc.id, None, pre, model_snapshot(enc), request,
                      metadata={"override": override_reason})
            logger.info("Hard override triggered for encounter %s: %s", encounter_id, override_reason)

            return {
                "encounter_id": str(enc.id),
                "priority": "critical",
                "risk_score": MAX_RISK_SCORE,
                "effective_score": MAX_RISK_SCORE,
                "confidence_score": confidence,
                "reasons": [override_reason],
                "hard_override": True,
            }

        # Step 3: Weighted scoring
        base_score, reasons = _evaluate_weighted_conditions(vitals, symptoms, patient_age, dept_config)

        # Step 4: Aging bonus
        aging_minutes_unit = dept_config.get("aging_minutes_unit", DEFAULT_AGING_MINUTES_UNIT)
        aging_point_unit = dept_config.get("aging_point_unit", DEFAULT_AGING_POINT_UNIT)
        minutes_waited = (dj_tz.now() - enc.created_at).total_seconds() / 60.0
        aging_bonus = math.floor(minutes_waited / aging_minutes_unit) * aging_point_unit
        if aging_bonus > 0:
            reasons.append(f"Waiting time bonus: +{aging_bonus} pts ({minutes_waited:.0f} min waited)")

        effective_score = base_score + aging_bonus
        priority = _map_score_to_priority(effective_score)

        # Step 5: Confidence
        min_complete_ratio = dept_config.get("min_complete_ratio", DEFAULT_MIN_COMPLETE_RATIO)
        low_complete_penalty = dept_config.get("low_completeness_penalty", DEFAULT_LOW_COMPLETENESS_PENALTY)
        confidence = round(completeness * 100)
        if completeness < min_complete_ratio:
            confidence = max(0, confidence - low_complete_penalty)

        # Save
        pre = model_snapshot(enc)
        enc.priority = priority
        enc.risk_score = effective_score
        enc.confidence_score = confidence
        enc.version += 1
        enc.save()

        _upsert_triage_data(enc, vitals, symptoms, red_flags, completeness)
        log_audit("triage.analyze", "encounter", enc.id, None, pre, model_snapshot(enc), request,
                  metadata={"score": effective_score, "reasons": reasons})

        logger.info(
            "Triage complete encounter=%s priority=%s score=%d confidence=%d reasons=%d",
            encounter_id, priority, effective_score, confidence, len(reasons)
        )

        return {
            "encounter_id": str(enc.id),
            "priority": priority,
            "risk_score": base_score,
            "effective_score": effective_score,
            "aging_bonus": aging_bonus,
            "confidence_score": confidence,
            "reasons": reasons,
            "hard_override": False,
        }


def _upsert_triage_data(enc, vitals, symptoms, red_flags, completeness):
    """Create or update the TriageData record for an encounter."""
    from core.models import TriageData
    TriageData.objects.update_or_create(
        encounter=enc,
        defaults={
            "vitals_json": vitals,
            "symptoms_json": symptoms,
            "red_flag_json": red_flags,
            "data_completeness_ratio": completeness,
        },
    )
