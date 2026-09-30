import pytest
from datetime import timedelta
from django.utils import timezone
from patients.models import Appointment, AppointmentClinician
from .conftest import make_clinic, make_clinician, make_patient, make_appointment


def iso(dt):
    return dt.isoformat().replace('+00:00', 'Z')


def future(hours=24):
    return timezone.now() + timedelta(hours=hours)


@pytest.mark.django_db
class TestAppointmentList:
    URL = '/api/appointments/'

    def test_list_own_appointments(self, auth_client, appointment):
        res = auth_client.get(self.URL)
        assert res.status_code == 200
        assert res.data['count'] == 1

    def test_does_not_see_other_clinic_appointments(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_patient = make_patient(other)
        make_appointment(other_patient)
        res = auth_client.get(self.URL)
        assert res.data['count'] == 0

    def test_filter_by_status(self, auth_client, clinic):
        p = make_patient(clinic)
        make_appointment(p, status='scheduled')
        make_appointment(p, scheduled_at=future(48), status='completed')
        res = auth_client.get(self.URL, {'status': 'completed'})
        assert res.data['count'] == 1
        assert res.data['results'][0]['status'] == 'completed'

    def test_filter_by_date_from(self, auth_client, clinic):
        p = make_patient(clinic)
        tomorrow = future(24)
        next_week = future(168)
        make_appointment(p, scheduled_at=tomorrow)
        make_appointment(p, scheduled_at=next_week)
        date_str = (tomorrow + timedelta(days=3)).strftime('%Y-%m-%d')
        res = auth_client.get(self.URL, {'date_from': date_str})
        assert res.data['count'] == 1

    def test_filter_by_date_to(self, auth_client, clinic):
        p = make_patient(clinic)
        make_appointment(p, scheduled_at=future(24))
        make_appointment(p, scheduled_at=future(168))
        date_str = future(72).strftime('%Y-%m-%d')
        res = auth_client.get(self.URL, {'date_to': date_str})
        assert res.data['count'] == 1

    def test_filter_by_patient(self, auth_client, clinic):
        p1 = make_patient(clinic, name='P1')
        p2 = make_patient(clinic, name='P2')
        make_appointment(p1)
        make_appointment(p2, scheduled_at=future(48))
        res = auth_client.get(self.URL, {'patient': p1.id})
        assert res.data['count'] == 1

    def test_search_by_patient_name(self, auth_client, clinic):
        p1 = make_patient(clinic, name='Alice Smith')
        p2 = make_patient(clinic, name='Bob Jones')
        make_appointment(p1)
        make_appointment(p2, scheduled_at=future(48))
        res = auth_client.get(self.URL, {'search': 'alice'})
        assert res.data['count'] == 1

    def test_unauthenticated(self, client):
        res = client.get(self.URL)
        assert res.status_code == 401

    def test_overdue_scheduled_auto_completes(self, auth_client, clinic):
        from datetime import timedelta
        from django.utils import timezone
        from patients.models import Appointment
        from .conftest import make_patient, make_appointment

        p = make_patient(clinic)
        past = timezone.now() - timedelta(hours=2)
        appt = make_appointment(p, scheduled_at=past, duration_minutes=30, status='scheduled')

        res = auth_client.get(self.URL, {'page_size': 50})
        assert res.status_code == 200
        appt.refresh_from_db()
        assert appt.status == 'completed'
        assert Appointment.objects.filter(id=appt.id, status='completed').exists()


@pytest.mark.django_db
class TestAppointmentCreate:
    URL = '/api/appointments/'

    def test_create_success(self, auth_client, patient, clinician):
        payload = {
            'patient': patient.id,
            'scheduled_at': iso(future(24)),
            'duration_minutes': 30,
            'status': 'scheduled',
            'clinician_ids': [clinician.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 201
        assert res.data['patient'] == patient.id
        assert len(res.data['appointment_clinicians']) == 1
        assert res.data['appointment_clinicians'][0]['clinician_name'] == clinician.name

    def test_create_without_clinicians_rejected(self, auth_client, patient):
        payload = {
            'patient': patient.id,
            'scheduled_at': iso(future(24)),
            'duration_minutes': 45,
            'status': 'scheduled',
            'clinician_ids': [],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 400
        assert 'clinician_ids' in res.data

    def test_create_with_multiple_clinicians(self, auth_client, clinic, patient):
        c1 = make_clinician(clinic, name='C1', email='c1@x.com')
        c2 = make_clinician(clinic, name='C2', email='c2@x.com')
        payload = {
            'patient': patient.id,
            'scheduled_at': iso(future(24)),
            'duration_minutes': 30,
            'clinician_ids': [c1.id, c2.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 201
        assert len(res.data['appointment_clinicians']) == 2

    def test_patient_double_booking_rejected(self, auth_client, clinic, patient, clinician):
        start = future(24)
        make_appointment(patient, scheduled_at=start, duration_minutes=60)
        payload = {
            'patient': patient.id,
            'scheduled_at': iso(start + timedelta(minutes=30)),
            'duration_minutes': 30,
            'clinician_ids': [clinician.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 400
        assert 'scheduled_at' in res.data

    def test_patient_adjacent_slots_allowed(self, auth_client, clinic, patient, clinician):
        start = future(24)
        make_appointment(patient, scheduled_at=start, duration_minutes=30)
        payload = {
            'patient': patient.id,
            'scheduled_at': iso(start + timedelta(minutes=30)),
            'duration_minutes': 30,
            'clinician_ids': [clinician.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 201

    def test_clinician_double_booking_rejected(self, auth_client, clinic, patient):
        start = future(24)
        c = make_clinician(clinic, name='Busy Dr')
        p2 = make_patient(clinic, name='P2')
        appt = make_appointment(patient, scheduled_at=start, duration_minutes=60)
        AppointmentClinician.objects.create(appointment=appt, clinician=c)

        payload = {
            'patient': p2.id,
            'scheduled_at': iso(start + timedelta(minutes=30)),
            'duration_minutes': 30,
            'clinician_ids': [c.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 400
        assert 'clinician_ids' in res.data

    def test_cancelled_appointment_does_not_block_slot(self, auth_client, clinic, patient, clinician):
        start = future(24)
        make_appointment(patient, scheduled_at=start, duration_minutes=60, status='cancelled')
        payload = {
            'patient': patient.id,
            'scheduled_at': iso(start),
            'duration_minutes': 30,
            'clinician_ids': [clinician.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 201

    def test_no_show_does_not_block_slot(self, auth_client, clinic, patient, clinician):
        start = future(24)
        make_appointment(patient, scheduled_at=start, duration_minutes=60, status='no_show')
        payload = {
            'patient': patient.id,
            'scheduled_at': iso(start),
            'duration_minutes': 30,
            'clinician_ids': [clinician.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 201

    def test_cannot_use_other_clinic_patient(self, auth_client, clinician, db):
        other = make_clinic(email='o@x.com', name='O')
        other_patient = make_patient(other)
        payload = {
            'patient': other_patient.id,
            'scheduled_at': iso(future(24)),
            'duration_minutes': 30,
            'clinician_ids': [clinician.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 400

    def test_cannot_use_other_clinic_clinician(self, auth_client, patient, db):
        other = make_clinic(email='o@x.com', name='O')
        other_c = make_clinician(other)
        payload = {
            'patient': patient.id,
            'scheduled_at': iso(future(24)),
            'duration_minutes': 30,
            'clinician_ids': [other_c.id],
        }
        res = auth_client.post(self.URL, payload, format='json')
        assert res.status_code == 400

    def test_missing_patient(self, auth_client):
        res = auth_client.post(self.URL, {'scheduled_at': iso(future(24)), 'duration_minutes': 30}, format='json')
        assert res.status_code == 400


@pytest.mark.django_db
class TestAppointmentRetrieve:
    def test_retrieve_own(self, auth_client, appointment):
        res = auth_client.get(f'/api/appointments/{appointment.id}/')
        assert res.status_code == 200
        assert 'patient_detail' in res.data
        assert 'appointment_clinicians' in res.data

    def test_cannot_retrieve_other_clinic_appointment(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_patient = make_patient(other)
        other_appt = make_appointment(other_patient)
        res = auth_client.get(f'/api/appointments/{other_appt.id}/')
        assert res.status_code == 404


@pytest.mark.django_db
class TestAppointmentUpdate:
    def test_update_status(self, auth_client, appointment):
        res = auth_client.patch(f'/api/appointments/{appointment.id}/', {'status': 'completed'}, format='json')
        assert res.status_code == 200
        assert res.data['status'] == 'completed'
        appointment.refresh_from_db()
        assert appointment.status == 'completed'

    def test_update_reschedule(self, auth_client, appointment):
        new_time = future(48)
        res = auth_client.patch(f'/api/appointments/{appointment.id}/', {'scheduled_at': iso(new_time)}, format='json')
        assert res.status_code == 200

    def test_update_does_not_conflict_with_itself(self, auth_client, appointment):
        # Rescheduling to same time should not trigger self-conflict
        res = auth_client.patch(
            f'/api/appointments/{appointment.id}/',
            {'scheduled_at': iso(appointment.scheduled_at), 'duration_minutes': 45},
            format='json',
        )
        assert res.status_code == 200

    def test_update_time_conflict_rejected(self, auth_client, clinic, patient):
        start = future(24)
        appt1 = make_appointment(patient, scheduled_at=start, duration_minutes=60)
        appt2 = make_appointment(patient, scheduled_at=future(72), duration_minutes=30)
        res = auth_client.patch(
            f'/api/appointments/{appt2.id}/',
            {'scheduled_at': iso(start + timedelta(minutes=30))},
            format='json',
        )
        assert res.status_code == 400

    def test_update_clinicians(self, auth_client, clinic, appointment):
        c1 = make_clinician(clinic, name='C1', email='c1@x.com')
        c2 = make_clinician(clinic, name='C2', email='c2@x.com')
        auth_client.patch(f'/api/appointments/{appointment.id}/', {'clinician_ids': [c1.id]}, format='json')
        res = auth_client.patch(f'/api/appointments/{appointment.id}/', {'clinician_ids': [c2.id]}, format='json')
        assert res.status_code == 200
        ids = [ac['clinician'] for ac in res.data['appointment_clinicians']]
        assert c1.id not in ids
        assert c2.id in ids

    def test_update_to_empty_clinicians_rejected(self, auth_client, clinic, appointment):
        res = auth_client.patch(
            f'/api/appointments/{appointment.id}/',
            {'clinician_ids': []},
            format='json',
        )
        assert res.status_code == 400
        assert 'clinician_ids' in res.data

    def test_cannot_update_other_clinic_appointment(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_patient = make_patient(other)
        other_appt = make_appointment(other_patient)
        res = auth_client.patch(f'/api/appointments/{other_appt.id}/', {'status': 'completed'}, format='json')
        assert res.status_code == 404


@pytest.mark.django_db
class TestAppointmentDelete:
    def test_delete_success(self, auth_client, appointment):
        res = auth_client.delete(f'/api/appointments/{appointment.id}/')
        assert res.status_code == 204
        assert not Appointment.objects.filter(id=appointment.id).exists()

    def test_delete_also_removes_bridge_rows(self, auth_client, clinic, patient):
        c = make_clinician(clinic)
        appt = make_appointment(patient)
        AppointmentClinician.objects.create(appointment=appt, clinician=c)
        auth_client.delete(f'/api/appointments/{appt.id}/')
        assert not AppointmentClinician.objects.filter(appointment=appt).exists()

    def test_cannot_delete_other_clinic_appointment(self, auth_client, db):
        other = make_clinic(email='o@x.com', name='O')
        other_patient = make_patient(other)
        other_appt = make_appointment(other_patient)
        res = auth_client.delete(f'/api/appointments/{other_appt.id}/')
        assert res.status_code == 404

    def test_deleting_patient_cascades_to_appointments(self, auth_client, patient, appointment):
        auth_client.delete(f'/api/patients/{patient.id}/')
        assert not Appointment.objects.filter(id=appointment.id).exists()
