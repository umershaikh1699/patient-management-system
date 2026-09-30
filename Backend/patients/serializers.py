from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Clinic, Clinician, Patient, Appointment, AppointmentClinician


# ── Auth ──────────────────────────────────────────────────────────────────────

class ClinicTokenSerializer(TokenObtainPairSerializer):
    # Return clinic profile info alongside JWTs on login.
    def validate(self, attrs):
        data = super().validate(attrs)
        data['clinic'] = {'id': self.user.id, 'email': self.user.email, 'name': self.user.name}
        return data


class ClinicRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = Clinic
        fields = ['id', 'email', 'password', 'name']

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return Clinic.objects.create_user(**validated_data)


class ClinicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinic
        fields = ['id', 'email', 'name']
        read_only_fields = ['id']

    def validate_email(self, value):
        qs = Clinic.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('This email is already in use.')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()


# ── Clinician ─────────────────────────────────────────────────────────────────

class ClinicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinician
        fields = ['id', 'name', 'specialization', 'email', 'created_at', 'is_deleted']
        read_only_fields = ['created_at']

    def validate_email(self, value):
        if not value:
            return value
        # Uniqueness is scoped per clinic; soft-deleted clinicians do not block reuse.
        qs = Clinician.objects.filter(clinic=self.context['request'].user, email=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'A clinician with this email already exists in your clinic.'
            )
        return value


# ── Patient ───────────────────────────────────────────────────────────────────

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ['id', 'name', 'gender', 'email', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def validate_email(self, value):
        if not value:
            return value
        # Uniqueness is scoped per clinic.
        qs = Patient.objects.filter(clinic=self.context['request'].user, email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'A patient with this email already exists in your clinic.'
            )
        return value


# ── Appointment ───────────────────────────────────────────────────────────────

class AppointmentPatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ['id', 'name', 'gender']


class AppointmentClinicianSerializer(serializers.ModelSerializer):
    clinician_name = serializers.CharField(source='clinician.name', read_only=True)

    class Meta:
        model = AppointmentClinician
        fields = ['id', 'clinician', 'clinician_name']


class AppointmentSerializer(serializers.ModelSerializer):
    patient_detail = AppointmentPatientSerializer(source='patient', read_only=True)
    appointment_clinicians = AppointmentClinicianSerializer(many=True, read_only=True)
    clinician_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, default=list
    )

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_detail',
            'scheduled_at', 'duration_minutes', 'status',
            'created_at', 'updated_at',
            'appointment_clinicians', 'clinician_ids',
        ]
        read_only_fields = ['created_at', 'updated_at']

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _overlaps(self, existing, new_start, new_end):
        # Overlap check for half-open intervals: [start, end).
        existing_end = existing.scheduled_at + timedelta(minutes=existing.duration_minutes)
        return new_start < existing_end and new_end > existing.scheduled_at

    def _active(self, qs):
        # Cancelled/no-show appointments should not block slots.
        return qs.exclude(status__in=['cancelled', 'no_show'])

    # ── Validation ───────────────────────────────────────────────────────────

    def validate(self, attrs):
        clinic = self.context['request'].user
        instance = self.instance

        patient = attrs.get('patient', getattr(instance, 'patient', None))
        scheduled_at = attrs.get('scheduled_at', getattr(instance, 'scheduled_at', None))
        duration_minutes = attrs.get('duration_minutes', getattr(instance, 'duration_minutes', 30))
        clinician_ids = attrs.get('clinician_ids', [])
        exclude_pk = instance.pk if instance else None

        # 0. Minimum clinician requirement
        if instance is None:
            if not clinician_ids:
                raise serializers.ValidationError(
                    {'clinician_ids': 'At least one clinician is required.'}
                )
        elif 'clinician_ids' in attrs and not attrs['clinician_ids']:
            raise serializers.ValidationError(
                {'clinician_ids': 'At least one clinician is required.'}
            )

        # 1. Cross-clinic isolation
        if patient and patient.clinic_id != clinic.pk:
            raise serializers.ValidationError({'patient': 'Invalid patient.'})

        if clinician_ids:
            foreign = list(
                Clinician.objects
                .filter(pk__in=clinician_ids, is_deleted=False)
                .exclude(clinic=clinic)
                .values_list('pk', flat=True)
            )
            if foreign:
                raise serializers.ValidationError(
                    {'clinician_ids': 'One or more clinicians do not belong to your clinic.'}
                )

        # 2. Time-conflict checks — skip if neither scheduling field is changing on an update.
        # Note: this is application-level validation (clear and testable) but not race-proof
        # under concurrent creates/updates; production systems typically add DB-level protection.
        time_fields_changing = 'scheduled_at' in attrs or 'duration_minutes' in attrs
        if instance is None or time_fields_changing:
            new_end = scheduled_at + timedelta(minutes=duration_minutes)

            # Patient double-booking
            patient_qs = self._active(Appointment.objects.filter(patient=patient))
            if exclude_pk:
                patient_qs = patient_qs.exclude(pk=exclude_pk)
            for appt in patient_qs:
                if self._overlaps(appt, scheduled_at, new_end):
                    appt_end = appt.scheduled_at + timedelta(minutes=appt.duration_minutes)
                    raise serializers.ValidationError({
                        'scheduled_at': (
                            f'This patient already has an appointment from '
                            f'{appt.scheduled_at:%H:%M} to {appt_end:%H:%M} '
                            f'on {appt.scheduled_at:%Y-%m-%d}.'
                        )
                    })

            # Clinician double-booking
            for cid in clinician_ids:
                clinician_qs = self._active(
                    Appointment.objects.filter(appointment_clinicians__clinician_id=cid)
                )
                if exclude_pk:
                    clinician_qs = clinician_qs.exclude(pk=exclude_pk)
                for appt in clinician_qs:
                    if self._overlaps(appt, scheduled_at, new_end):
                        appt_end = appt.scheduled_at + timedelta(minutes=appt.duration_minutes)
                        name = (
                            Clinician.objects
                            .filter(pk=cid, is_deleted=False)
                            .values_list('name', flat=True)
                            .first()
                        )
                        raise serializers.ValidationError({
                            'clinician_ids': (
                                f'Clinician {name} already has an appointment from '
                                f'{appt.scheduled_at:%H:%M} to {appt_end:%H:%M} '
                                f'on {appt.scheduled_at:%Y-%m-%d}.'
                            )
                        })

        return attrs

    # ── Write ────────────────────────────────────────────────────────────────

    def create(self, validated_data):
        clinician_ids = validated_data.pop('clinician_ids', [])
        appointment = Appointment.objects.create(**validated_data)
        AppointmentClinician.objects.bulk_create([
            AppointmentClinician(appointment=appointment, clinician_id=cid)
            for cid in clinician_ids
        ])
        return appointment

    def update(self, instance, validated_data):
        clinician_ids = validated_data.pop('clinician_ids', None)
        appointment = super().update(instance, validated_data)
        if clinician_ids is not None:
            # Replace bridge rows in one shot for simplicity.
            appointment.appointment_clinicians.all().delete()
            AppointmentClinician.objects.bulk_create([
                AppointmentClinician(appointment=appointment, clinician_id=cid)
                for cid in clinician_ids
            ])
        return appointment
