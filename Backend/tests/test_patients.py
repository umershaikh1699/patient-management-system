import pytest
from patients.models import Patient
from .conftest import make_clinic, make_patient


@pytest.mark.django_db
class TestPatientList:
    URL = '/api/patients/'

    def test_list_own_patients(self, auth_client, patient):
        res = auth_client.get(self.URL)
        assert res.status_code == 200
        assert res.data['count'] == 1
        assert res.data['results'][0]['name'] == patient.name

    def test_does_not_see_other_clinic_patients(self, auth_client, db):
        other = make_clinic(email='other@x.com', name='Other')
        make_patient(other, name='Hidden Patient')
        res = auth_client.get(self.URL)
        assert res.data['count'] == 0

    def test_search_by_name(self, auth_client, clinic):
        make_patient(clinic, name='Alice')
        make_patient(clinic, name='Bob')
        res = auth_client.get(self.URL, {'search': 'alice'})
        assert res.data['count'] == 1
        assert res.data['results'][0]['name'] == 'Alice'

    def test_search_by_email(self, auth_client, clinic):
        make_patient(clinic, name='Alice', email='alice@example.com')
        make_patient(clinic, name='Bob', email='bob@example.com')
        res = auth_client.get(self.URL, {'search': 'alice@'})
        assert res.data['count'] == 1

    def test_unauthenticated(self, client):
        res = client.get(self.URL)
        assert res.status_code == 401

    def test_pagination(self, auth_client, clinic):
        for i in range(5):
            make_patient(clinic, name=f'Patient {i}')
        res = auth_client.get(self.URL, {'page_size': 3})
        assert len(res.data['results']) == 3
        assert res.data['count'] == 5


@pytest.mark.django_db
class TestPatientCreate:
    URL = '/api/patients/'

    def test_create_success(self, auth_client):
        res = auth_client.post(self.URL, {'name': 'New Patient', 'gender': 'M', 'email': 'p@test.com'}, format='json')
        assert res.status_code == 201
        assert res.data['name'] == 'New Patient'
        assert Patient.objects.filter(name='New Patient').exists()

    def test_create_without_email(self, auth_client):
        res = auth_client.post(self.URL, {'name': 'No Email', 'gender': 'F'}, format='json')
        assert res.status_code == 201

    def test_create_duplicate_email_same_clinic(self, auth_client, patient):
        make_patient_with_email = {'name': 'Dup', 'gender': 'M', 'email': 'dup@x.com'}
        auth_client.post(self.URL, make_patient_with_email, format='json')
        res = auth_client.post(self.URL, make_patient_with_email, format='json')
        assert res.status_code == 400

    def test_duplicate_blank_email_allowed(self, auth_client):
        auth_client.post(self.URL, {'name': 'P1', 'gender': 'M', 'email': ''}, format='json')
        res = auth_client.post(self.URL, {'name': 'P2', 'gender': 'F', 'email': ''}, format='json')
        assert res.status_code == 201

    def test_missing_required_fields(self, auth_client):
        res = auth_client.post(self.URL, {'name': 'No Gender'}, format='json')
        assert res.status_code == 400

    def test_invalid_gender(self, auth_client):
        res = auth_client.post(self.URL, {'name': 'X', 'gender': 'X'}, format='json')
        assert res.status_code == 400


@pytest.mark.django_db
class TestPatientRetrieve:
    def test_retrieve_own(self, auth_client, patient):
        res = auth_client.get(f'/api/patients/{patient.id}/')
        assert res.status_code == 200
        assert res.data['id'] == patient.id

    def test_cannot_retrieve_other_clinic_patient(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_patient = make_patient(other, name='Hidden')
        res = auth_client.get(f'/api/patients/{other_patient.id}/')
        assert res.status_code == 404


@pytest.mark.django_db
class TestPatientUpdate:
    def test_partial_update(self, auth_client, patient):
        res = auth_client.patch(f'/api/patients/{patient.id}/', {'name': 'Updated Name'}, format='json')
        assert res.status_code == 200
        assert res.data['name'] == 'Updated Name'
        patient.refresh_from_db()
        assert patient.name == 'Updated Name'

    def test_update_email_to_duplicate(self, auth_client, clinic):
        p1 = make_patient(clinic, name='P1', email='p1@x.com')
        p2 = make_patient(clinic, name='P2', email='p2@x.com')
        res = auth_client.patch(f'/api/patients/{p2.id}/', {'email': 'p1@x.com'}, format='json')
        assert res.status_code == 400

    def test_cannot_update_other_clinic_patient(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_patient = make_patient(other, name='Hidden')
        res = auth_client.patch(f'/api/patients/{other_patient.id}/', {'name': 'X'}, format='json')
        assert res.status_code == 404


@pytest.mark.django_db
class TestPatientDelete:
    def test_delete_success(self, auth_client, patient):
        res = auth_client.delete(f'/api/patients/{patient.id}/')
        assert res.status_code == 204
        assert not Patient.objects.filter(id=patient.id).exists()

    def test_cannot_delete_other_clinic_patient(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_patient = make_patient(other, name='Hidden')
        res = auth_client.delete(f'/api/patients/{other_patient.id}/')
        assert res.status_code == 404
