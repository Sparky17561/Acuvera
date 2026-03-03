"""
Escalation API views.
"""
from rest_framework.views import APIView
from core.exceptions import ok, err
from core.permissions import IsAuthenticatedViaJWT, IsNurseOrAdmin


class TriggerEscalationView(APIView):
    """POST /api/escalation/trigger/"""
    permission_classes = [IsAuthenticatedViaJWT]

    def post(self, request):
        encounter_id = request.data.get("encounter_id")
        escalation_type = request.data.get("type")
        if not encounter_id or not escalation_type:
            return err("encounter_id and type are required.", 400)

        from escalation.engine import trigger_escalation
        result = trigger_escalation(
            encounter_id=str(encounter_id),
            escalation_type=escalation_type,
            triggered_by=request.acuvera_user,
            request=request,
        )
        if not result["success"]:
            return err(result["error"], 400)
        return ok(result, status=201)


class AcknowledgeEscalationView(APIView):
    """POST /api/escalation/acknowledge/"""
    permission_classes = [IsAuthenticatedViaJWT]

    def post(self, request):
        event_id = request.data.get("event_id")
        if not event_id:
            return err("event_id is required.", 400)

        from escalation.engine import acknowledge_escalation
        result = acknowledge_escalation(
            event_id=str(event_id),
            acknowledging_doctor=request.acuvera_user,
            request=request,
        )
        if not result["success"]:
            return err(result["error"], 400)
        return ok(result)


class EscalationEventsView(APIView):
    """GET /api/escalation/events/?department=<id>"""
    permission_classes = [IsAuthenticatedViaJWT]

    def get(self, request):
        from core.models import EscalationEvent
        from rest_framework import serializers as drf_serializers

        qs = EscalationEvent.objects.select_related("encounter", "triggered_by", "acknowledged_by").order_by("-timestamp")
        dept_id = request.query_params.get("department")
        if dept_id:
            qs = qs.filter(encounter__department_id=dept_id)

        data = list(qs.values(
            "id", "encounter_id", "type", "triggered_by_id",
            "response_time", "acknowledged_by_id", "acknowledged_at",
            "sla_breached", "timestamp",
        ))
        return ok(data)
