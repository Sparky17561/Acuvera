"""Core API URL patterns."""
from django.urls import path
from core.views import (
    WhoAmIView, RegisterUserView, LoginView,
    PatientListCreateView, PatientDetailView,
    EncounterListCreateView, EncounterDetailView, EncounterAssignView,
    DepartmentListView, DoctorListView, UserAvailabilityView,
    StaffListView, StaffDetailView,
)

urlpatterns = [
    path("auth/whoami/", WhoAmIView.as_view()),
    path("auth/register/", RegisterUserView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("patients/", PatientListCreateView.as_view()),
    path("patients/<uuid:pk>/", PatientDetailView.as_view()),
    path("encounters/", EncounterListCreateView.as_view()),
    path("encounters/<uuid:pk>/", EncounterDetailView.as_view()),
    path("encounters/<uuid:pk>/assign/", EncounterAssignView.as_view()),
    path("departments/", DepartmentListView.as_view()),
    path("doctors/", DoctorListView.as_view()),
    path("users/<uuid:pk>/availability/", UserAvailabilityView.as_view()),
    
    # Admin Staff Management
    path("admin/staff/", StaffListView.as_view()),
    path("admin/staff/<uuid:pk>/", StaffDetailView.as_view()),
]
