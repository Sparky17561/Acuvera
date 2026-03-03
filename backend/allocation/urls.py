from django.urls import path
from allocation.views import SuggestDoctorView, ConfirmAllocationView, RespondAllocationView

urlpatterns = [
    path("allocation/suggest/<uuid:encounter_id>/", SuggestDoctorView.as_view()),
    path("allocation/confirm/", ConfirmAllocationView.as_view()),
    path("allocation/respond/", RespondAllocationView.as_view()),
]
