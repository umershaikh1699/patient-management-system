import pytest
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from patients.models import Clinic, Clinician, Patient, Appointment, AppointmentClinician


# ── Factories ──────────────────────────────────────────────────────────────────

def make_clinic(email='clinic@test.com', password='pass1234', name='Test Clinic'):
    return Clinic.objects.create_user(email=email, password=password, name=name)


def make_clinician(clinic, name='Dr. Smith', specialization='General', email=''):
    return Clinician.objects.create(clinic=clinic, name=name, specialization=specialization, email=email, is_deleted=False)


def make_patient(clinic, name='Jane Doe', gender='F', email=''):
    return Patient.objects.create(clinic=clinic, name=name, gender=gender, email=email)


def make_appointment(patient, scheduled_at=None, duration_minutes=30, status='scheduled'):
    if scheduled_at is None:
        scheduled_at = timezone.now() + timedelta(days=1)
    return Appointment.objects.create(
        patient=patient,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        status=status,
    )


# ── Pytest fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def clinic(db):
    return make_clinic()


@pytest.fixture
def other_clinic(db):
    return make_clinic(email='other@test.com', name='Other Clinic')


@pytest.fixture
def auth_client(db, clinic):
    c = APIClient()
    res = c.post('/api/auth/login/', {'email': 'clinic@test.com', 'password': 'pass1234'}, format='json')
    c.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return c


@pytest.fixture
def clinician(db, clinic):
    return make_clinician(clinic)


@pytest.fixture
def patient(db, clinic):
    return make_patient(clinic)


@pytest.fixture
def appointment(db, patient):
    return make_appointment(patient)
