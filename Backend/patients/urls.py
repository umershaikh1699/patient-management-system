from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ClinicLoginView, RegisterView, MeView, ChangePasswordView,
    ClinicianViewSet, PatientViewSet, AppointmentViewSet,
)

# Router exposes standard CRUD endpoints for resources.
router = DefaultRouter()
router.register(r'clinicians', ClinicianViewSet, basename='clinician')
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'appointments', AppointmentViewSet, basename='appointment')

urlpatterns = [
    # Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', ClinicLoginView.as_view(), name='login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change_password'),

    # Resources
    path('', include(router.urls)),
]
