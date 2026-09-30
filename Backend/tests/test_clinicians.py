import pytest
from patients.models import Clinician, AppointmentClinician
from .conftest import make_clinic, make_clinician, make_patient, make_appointment


@pytest.mark.django_db
class TestClinicianList:
    URL = '/api/clinicians/'

    def test_list_own_clinicians(self, auth_client, clinician):
        res = auth_client.get(self.URL)
        assert res.status_code == 200
        assert res.data['count'] == 1
        assert res.data['results'][0]['name'] == clinician.name

    def test_does_not_see_other_clinic_clinicians(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        make_clinician(other, name='Hidden')
        res = auth_client.get(self.URL)
        assert res.data['count'] == 0

    def test_search_by_name(self, auth_client, clinic):
        make_clinician(clinic, name='Dr. Alice')
        make_clinician(clinic, name='Dr. Bob')
        res = auth_client.get(self.URL, {'search': 'alice'})
        assert res.data['count'] == 1

    def test_search_by_specialization(self, auth_client, clinic):
        make_clinician(clinic, name='A', specialization='Cardiology')
        make_clinician(clinic, name='B', specialization='Neurology')
        res = auth_client.get(self.URL, {'search': 'cardio'})
        assert res.data['count'] == 1

    def test_unauthenticated(self, client):
        res = client.get(self.URL)
        assert res.status_code == 401


@pytest.mark.django_db
class TestClinicianCreate:
    URL = '/api/clinicians/'

    def test_create_success(self, auth_client):
        res = auth_client.post(self.URL, {'name': 'Dr. New', 'specialization': 'ENT', 'email': 'dr@test.com'}, format='json')
        assert res.status_code == 201
        assert res.data['name'] == 'Dr. New'
        assert Clinician.objects.filter(name='Dr. New').exists()

    def test_create_without_optional_fields(self, auth_client):
        res = auth_client.post(self.URL, {'name': 'Dr. Minimal'}, format='json')
        assert res.status_code == 201

    def test_duplicate_email_same_clinic(self, auth_client):
        auth_client.post(self.URL, {'name': 'A', 'email': 'same@x.com'}, format='json')
        res = auth_client.post(self.URL, {'name': 'B', 'email': 'same@x.com'}, format='json')
        assert res.status_code == 400

    def test_same_email_different_clinics_allowed(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        make_clinician(other, email='shared@x.com')
        res = auth_client.post(self.URL, {'name': 'Mine', 'email': 'shared@x.com'}, format='json')
        assert res.status_code == 201

    def test_duplicate_blank_email_allowed(self, auth_client):
        auth_client.post(self.URL, {'name': 'C1', 'email': ''}, format='json')
        res = auth_client.post(self.URL, {'name': 'C2', 'email': ''}, format='json')
        assert res.status_code == 201

    def test_missing_name(self, auth_client):
        res = auth_client.post(self.URL, {'specialization': 'ENT'}, format='json')
        assert res.status_code == 400


@pytest.mark.django_db
class TestClinicianRetrieve:
    def test_retrieve_own(self, auth_client, clinician):
        res = auth_client.get(f'/api/clinicians/{clinician.id}/')
        assert res.status_code == 200
        assert res.data['id'] == clinician.id

    def test_cannot_retrieve_other_clinic_clinician(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_c = make_clinician(other, name='Hidden')
        res = auth_client.get(f'/api/clinicians/{other_c.id}/')
        assert res.status_code == 404


@pytest.mark.django_db
class TestClinicianUpdate:
    def test_partial_update(self, auth_client, clinician):
        res = auth_client.patch(f'/api/clinicians/{clinician.id}/', {'specialization': 'Neurology'}, format='json')
        assert res.status_code == 200
        assert res.data['specialization'] == 'Neurology'
        clinician.refresh_from_db()
        assert clinician.specialization == 'Neurology'

    def test_update_email_to_duplicate(self, auth_client, clinic):
        c1 = make_clinician(clinic, name='C1', email='c1@x.com')
        c2 = make_clinician(clinic, name='C2', email='c2@x.com')
        res = auth_client.patch(f'/api/clinicians/{c2.id}/', {'email': 'c1@x.com'}, format='json')
        assert res.status_code == 400

    def test_cannot_update_other_clinic_clinician(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_c = make_clinician(other, name='Hidden')
        res = auth_client.patch(f'/api/clinicians/{other_c.id}/', {'name': 'X'}, format='json')
        assert res.status_code == 404


@pytest.mark.django_db
class TestClinicianDelete:
    def test_delete_success(self, auth_client, clinician):
        res = auth_client.delete(f'/api/clinicians/{clinician.id}/')
        assert res.status_code == 204
        clinician.refresh_from_db()
        assert clinician.is_deleted is True
        assert auth_client.get(f'/api/clinicians/{clinician.id}/').status_code == 404

    def test_cannot_delete_other_clinic_clinician(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_c = make_clinician(other, name='Hidden')
        res = auth_client.delete(f'/api/clinicians/{other_c.id}/')
        assert res.status_code == 404

    def test_cannot_delete_clinician_with_scheduled_appointments(self, auth_client, clinic, clinician):
        patient = make_patient(clinic)
        appt = make_appointment(patient, status='scheduled')
        AppointmentClinician.objects.create(appointment=appt, clinician=clinician)
        res = auth_client.delete(f'/api/clinicians/{clinician.id}/')
        assert res.status_code == 400
        assert 'detail' in res.data
        clinician.refresh_from_db()
        assert clinician.is_deleted is False

    def test_can_delete_clinician_with_only_completed_appointments(self, auth_client, clinic, clinician):
        patient = make_patient(clinic)
        appt = make_appointment(patient, status='completed')
        AppointmentClinician.objects.create(appointment=appt, clinician=clinician)
        res = auth_client.delete(f'/api/clinicians/{clinician.id}/')
        assert res.status_code == 204
        clinician.refresh_from_db()
        assert clinician.is_deleted is True
