from rest_framework import viewsets, filters, generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils import timezone
from datetime import timedelta

from .models import Clinician, Patient, Appointment
from .serializers import (
    ClinicTokenSerializer, ClinicRegistrationSerializer, ClinicSerializer,
    ChangePasswordSerializer, ClinicianSerializer, PatientSerializer,
    AppointmentSerializer,
)


class ClinicLoginView(TokenObtainPairView):
    # JWT login endpoint (returns access/refresh + clinic profile).
    serializer_class = ClinicTokenSerializer


class RegisterView(generics.CreateAPIView):
    # Public registration endpoint for new clinics.
    serializer_class = ClinicRegistrationSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    # Read/update the current clinic profile (name/email).
    serializer_class = ClinicSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    # Change the current clinic's password.
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password updated successfully.'}, status=status.HTTP_200_OK)


class ClinicianViewSet(viewsets.ModelViewSet):
    serializer_class = ClinicianSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'specialization', 'email']
    ordering_fields = ['name', 'created_at']

    def get_queryset(self):
        return Clinician.objects.filter(clinic=self.request.user, is_deleted=False).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(clinic=self.request.user)

    def destroy(self, request, *args, **kwargs):
        clinician = self.get_object()
        # Block deletion if the clinician is still assigned to scheduled appointments.
        scheduled = (
            Appointment.objects
            .filter(appointment_clinicians__clinician=clinician, status='scheduled')
            .distinct()
            .count()
        )
        if scheduled:
            return Response(
                {'detail': (
                    f'Cannot delete this clinician. They have {scheduled} scheduled '
                    f'appointment(s). Reassign or cancel those appointments first.'
                )},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Soft delete keeps historical appointment links intact.
        clinician.is_deleted = True
        clinician.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email']
    ordering_fields = ['name', 'created_at']

    def get_queryset(self):
        return Patient.objects.filter(clinic=self.request.user)

    def perform_create(self, serializer):
        serializer.save(clinic=self.request.user)


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['patient__name']
    ordering_fields = ['scheduled_at', 'status', 'created_at']

    def _auto_complete_overdue(self, qs):
        """
        Auto-complete any scheduled appointments whose end time is in the past.
        This is a lightweight convenience for the demo app; for larger systems,
        you'd typically move this to a scheduled job or DB-level logic.
        """
        now = timezone.now()
        overdue = []
        for appt in qs.filter(status='scheduled'):
            end_at = appt.scheduled_at + timedelta(minutes=appt.duration_minutes)
            if end_at <= now:
                appt.status = 'completed'
                overdue.append(appt)
        if overdue:
            Appointment.objects.bulk_update(overdue, ['status'])

    def get_queryset(self):
        qs = (
            Appointment.objects
            .filter(patient__clinic=self.request.user)
            .select_related('patient')
            .prefetch_related('appointment_clinicians__clinician')
        )

        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)

        appt_status = self.request.query_params.get('status')
        if appt_status:
            qs = qs.filter(status=appt_status)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(scheduled_at__date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(scheduled_at__date__lte=date_to)

        return qs

    def list(self, request, *args, **kwargs):
        # Ensure status reflects time passage before returning results.
        self._auto_complete_overdue(self.get_queryset())
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._auto_complete_overdue(self.get_queryset())
        return super().retrieve(request, *args, **kwargs)
