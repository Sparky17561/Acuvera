"""
Core serializers: User, Patient, Encounter, TriageData.
"""
from rest_framework import serializers
from core.models import User, Patient, Encounter, TriageData, Department, HospitalConfig


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "profile_type", "starvation_threshold_minutes", "priority_weight_config", "is_active"]


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "clerk_user_id", "email", "full_name", "role",
            "department", "department_name", "is_active",
            "availability_state", "shift_start", "shift_end", "last_assigned_at",
        ]
        read_only_fields = ["id", "clerk_user_id"]

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ["id", "external_id", "name", "dob", "age", "gender", "contact_phone", "is_anonymized", "created_at"]


class TriageDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = TriageData
        fields = [
            "id", "encounter", "vitals_json", "symptoms_json", "red_flag_json",
            "raw_input_text", "llm_processed_json", "data_completeness_ratio", "created_at",
        ]
        read_only_fields = ["id", "encounter", "llm_processed_json", "data_completeness_ratio", "created_at"]


class EncounterSerializer(serializers.ModelSerializer):
    patient_detail = PatientSerializer(source="patient", read_only=True)
    triage_data = TriageDataSerializer(read_only=True)
    assigned_doctor_detail = UserSerializer(source="assigned_doctor", read_only=True)

    class Meta:
        model = Encounter
        fields = [
            "id", "patient", "patient_detail", "department",
            "status", "triage_stage", "priority", "risk_score", "confidence_score",
            "assigned_doctor", "assigned_doctor_detail", "rejection_count", "version",
            "notes", "is_deleted", "created_at", "updated_at",
            "triage_data",
        ]
        read_only_fields = ["id", "risk_score", "confidence_score", "version", "created_at", "updated_at"]


class AnalyzeTriageSerializer(serializers.Serializer):
    """Input for POST /api/triage/{encounter_id}/analyze/"""
    raw_input_text = serializers.CharField(required=False, allow_blank=True)
    vitals = serializers.JSONField(required=False)
    symptoms = serializers.ListField(child=serializers.CharField(), required=False)
    red_flags = serializers.JSONField(required=False)

    def validate(self, data):
        if not data.get("raw_input_text") and not data.get("vitals") and not data.get("symptoms"):
            raise serializers.ValidationError(
                "Provide at least one of: raw_input_text, vitals, or symptoms."
            )
        return data


class HospitalConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalConfig
        fields = "__all__"
