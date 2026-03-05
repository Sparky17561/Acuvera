"""
AI Clinical Insight Engine.
POST /api/encounters/{id}/insight/
Returns differential diagnoses + investigation suggestions via GROQ.
Results cached on Encounter.ai_insight_json — second call returns cache instantly.
"""
import random
import logging
from django.utils import timezone
from rest_framework.views import APIView
from core.exceptions import ok, err
from core.permissions import IsDoctor
from core.models import Encounter

logger = logging.getLogger("acuvera.insight")

# Deterministic fallback: symptom/vital → likely differentials + investigations
RULE_BASED_INSIGHTS = {
    "chest_pain": {
        "differentials": [
            {"condition": "Acute Coronary Syndrome", "confidence": "high"},
            {"condition": "Pulmonary Embolism", "confidence": "medium"},
            {"condition": "Aortic Dissection", "confidence": "medium"},
        ],
        "investigations": ["12-lead ECG", "Troponin I/T (stat)", "Chest X-Ray", "D-Dimer", "Echo if available"],
    },
    "shortness_of_breath": {
        "differentials": [
            {"condition": "Pneumonia / LRTI", "confidence": "high"},
            {"condition": "Acute Pulmonary Edema", "confidence": "medium"},
            {"condition": "COPD Exacerbation", "confidence": "medium"},
        ],
        "investigations": ["Chest X-Ray", "SpO2 monitoring", "ABG", "CBC with differential", "BNP/Pro-BNP"],
    },
    "stroke_symptoms": {
        "differentials": [
            {"condition": "Ischemic Stroke", "confidence": "high"},
            {"condition": "Hemorrhagic Stroke", "confidence": "medium"},
            {"condition": "TIA", "confidence": "medium"},
        ],
        "investigations": ["Non-contrast CT Head (urgent)", "Blood glucose", "INR/PT", "ECG for AF", "BP both arms"],
    },
    "trauma": {
        "differentials": [
            {"condition": "Traumatic Brain Injury", "confidence": "medium"},
            {"condition": "Internal Hemorrhage", "confidence": "medium"},
            {"condition": "Fracture", "confidence": "high"},
        ],
        "investigations": ["FAST ultrasound", "CT scan (trauma protocol)", "CBC", "Cross-match blood", "X-Ray affected region"],
    },
    "seizure": {
        "differentials": [
            {"condition": "Epileptic Seizure", "confidence": "high"},
            {"condition": "Hypoglycemia", "confidence": "medium"},
            {"condition": "Meningitis/Encephalitis", "confidence": "low"},
        ],
        "investigations": ["Blood glucose (stat)", "Electrolytes", "CT Head", "LP if fever present", "EEG if available"],
    },
    "syncope": {
        "differentials": [
            {"condition": "Vasovagal Syncope", "confidence": "high"},
            {"condition": "Cardiac Arrhythmia", "confidence": "medium"},
            {"condition": "Orthostatic Hypotension", "confidence": "medium"},
        ],
        "investigations": ["ECG", "Orthostatic BP measurements", "Blood glucose", "CBC", "Echo if cardiac suspected"],
    },
    "severe_abdominal_pain": {
        "differentials": [
            {"condition": "Appendicitis", "confidence": "medium"},
            {"condition": "Peptic Ulcer Perforation", "confidence": "medium"},
            {"condition": "Mesenteric Ischemia", "confidence": "low"},
        ],
        "investigations": ["Abdominal ultrasound", "CBC", "CRP/ESR", "Urinalysis", "Upright abdominal X-Ray"],
    },
    "altered_mental_status": {
        "differentials": [
            {"condition": "Metabolic Encephalopathy", "confidence": "high"},
            {"condition": "Sepsis", "confidence": "medium"},
            {"condition": "Intracranial Event", "confidence": "medium"},
        ],
        "investigations": ["Blood glucose (stat)", "Electrolytes", "Sepsis workup (cultures/lactate)", "CT Head", "Urinalysis"],
    },
}

DEFAULT_INSIGHT = {
    "differentials": [
        {"condition": "Clinical assessment required", "confidence": "low"},
    ],
    "investigations": ["Full vital sign monitoring", "CBC", "BMP", "Urinalysis"],
}

DISCLAIMER = (
    "⚠️ AI-generated suggestion only. Not a clinical diagnosis. "
    "All decisions must be made by the treating physician."
)


def _deterministic_insight(symptoms: list, vitals: dict) -> dict:
    """Rule-based fallback — match first known symptom pattern."""
    symptoms_lower = [s.lower().replace(" ", "_") for s in (symptoms or [])]

    # Priority order of symptom matching
    priority_symptoms = [
        "chest_pain", "stroke_symptoms", "seizure", "altered_mental_status",
        "shortness_of_breath", "trauma", "syncope", "severe_abdominal_pain"
    ]

    for key in priority_symptoms:
        if key in symptoms_lower:
            insight = RULE_BASED_INSIGHTS[key].copy()
            insight["source"] = "rule_based"
            insight["disclaimer"] = DISCLAIMER
            return insight

    # Vital-based fallback
    if vitals:
        spo2 = vitals.get("spo2")
        hr = vitals.get("hr")
        if spo2 and spo2 < 92:
            return {**RULE_BASED_INSIGHTS["shortness_of_breath"],
                    "source": "rule_based", "disclaimer": DISCLAIMER}
        if hr and hr > 140:
            return {**RULE_BASED_INSIGHTS["chest_pain"],
                    "source": "rule_based", "disclaimer": DISCLAIMER}

    return {**DEFAULT_INSIGHT, "source": "rule_based", "disclaimer": DISCLAIMER}


class InsightView(APIView):
    """POST /api/encounters/{pk}/insight/"""
    permission_classes = [IsDoctor]

    def post(self, request, pk):
        try:
            enc = Encounter.objects.select_related(
                "patient", "department"
            ).get(pk=pk, is_deleted=False)
        except Encounter.DoesNotExist:
            return err("Encounter not found.", 404)

        # Return cached insight if available
        if enc.ai_insight_json:
            logger.info("Returning cached AI insight for encounter %s", pk)
            return ok({**enc.ai_insight_json, "cached": True})

        # Load triage data
        vitals, symptoms = {}, []
        try:
            td = enc.triage_data
            vitals = td.vitals_json or {}
            symptoms = td.symptoms_json or []
        except Exception:
            pass

        # Try LLM first
        insight = None
        if request.feature_flags.get("LLM_ENABLED"):
            insight = self._call_llm_insight(enc, vitals, symptoms, request.feature_flags)

        # Fallback if no LLM (or LLM fails)
        if not insight:
            insight = _deterministic_insight(symptoms, vitals)
            logger.info("Using rule-based insight fallback for encounter %s", pk)

        insight["disclaimer"] = DISCLAIMER

        # Cache on the encounter
        enc.ai_insight_json = insight
        enc.save(update_fields=["ai_insight_json"])

        return ok({**insight, "cached": False})

    def _call_llm_insight(self, enc, vitals: dict, symptoms: list, feature_flags: dict) -> dict | None:
        try:
            from llm_sidecar.client import call_groq_json
            from llm_sidecar.prompts import CLINICAL_INSIGHT_PROMPT
            from llm_sidecar.sanitizer import sanitize_for_llm

            triage_dict = {"vitals_json": vitals, "symptoms_json": symptoms}
            patient_dict = {"age": enc.patient.age, "gender": enc.patient.gender}
            sanitized = sanitize_for_llm(triage_dict, patient_dict)

            user_content = (
                f"Patient: {sanitized.get('age_group', 'unknown age')} {sanitized.get('gender', '')}\n"
                f"Vitals: {sanitized.get('vitals', {})}\n"
                f"Symptoms: {', '.join(sanitized.get('symptoms', []) or [])}\n"
                f"Generate differential diagnosis and investigation suggestions."
            )

            result = call_groq_json(
                CLINICAL_INSIGHT_PROMPT,
                user_content,
                feature_flags,
                expected_keys=["differentials", "investigations"],
                max_tokens=400,
            )

            if result:
                result["source"] = "llm"
                logger.info("LLM clinical insight success for encounter %s", enc.id)
                return result

        except Exception as e:
            logger.warning("LLM insight failed for encounter %s: %s — using fallback", enc.id, e)

        return None
