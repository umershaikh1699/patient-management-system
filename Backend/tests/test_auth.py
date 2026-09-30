import pytest
from patients.models import Clinic


@pytest.mark.django_db
class TestRegister:
    URL = '/api/auth/register/'

    def test_register_success(self, client):
        res = client.post(self.URL, {'email': 'new@clinic.com', 'password': 'pass1234', 'name': 'New Clinic'}, format='json')
        assert res.status_code == 201
        assert res.data['email'] == 'new@clinic.com'
        assert Clinic.objects.filter(email='new@clinic.com').exists()

    def test_register_duplicate_email(self, client, clinic):
        res = client.post(self.URL, {'email': 'clinic@test.com', 'password': 'pass1234', 'name': 'Dup'}, format='json')
        assert res.status_code == 400

    def test_register_password_too_short(self, client):
        res = client.post(self.URL, {'email': 'x@x.com', 'password': 'short', 'name': 'X'}, format='json')
        assert res.status_code == 400

    def test_register_missing_fields(self, client):
        res = client.post(self.URL, {'email': 'x@x.com'}, format='json')
        assert res.status_code == 400


@pytest.mark.django_db
class TestLogin:
    URL = '/api/auth/login/'

    def test_login_success(self, client, clinic):
        res = client.post(self.URL, {'email': 'clinic@test.com', 'password': 'pass1234'}, format='json')
        assert res.status_code == 200
        assert 'access' in res.data
        assert 'refresh' in res.data
        assert res.data['clinic']['email'] == 'clinic@test.com'

    def test_login_wrong_password(self, client, clinic):
        res = client.post(self.URL, {'email': 'clinic@test.com', 'password': 'wrong'}, format='json')
        assert res.status_code == 401

    def test_login_unknown_email(self, client):
        res = client.post(self.URL, {'email': 'nobody@x.com', 'password': 'pass1234'}, format='json')
        assert res.status_code == 401


@pytest.mark.django_db
class TestTokenRefresh:
    def test_refresh_success(self, client, clinic):
        login = client.post('/api/auth/login/', {'email': 'clinic@test.com', 'password': 'pass1234'}, format='json')
        res = client.post('/api/auth/token/refresh/', {'refresh': login.data['refresh']}, format='json')
        assert res.status_code == 200
        assert 'access' in res.data

    def test_refresh_invalid_token(self, client):
        res = client.post('/api/auth/token/refresh/', {'refresh': 'bad.token.here'}, format='json')
        assert res.status_code == 401


@pytest.mark.django_db
class TestMe:
    URL = '/api/auth/me/'

    def test_get_profile(self, auth_client, clinic):
        res = auth_client.get(self.URL)
        assert res.status_code == 200
        assert res.data['email'] == clinic.email
        assert res.data['name'] == clinic.name

    def test_update_profile(self, auth_client):
        res = auth_client.patch(self.URL, {'name': 'Renamed Clinic'}, format='json')
        assert res.status_code == 200
        assert res.data['name'] == 'Renamed Clinic'

    def test_update_email_to_duplicate(self, auth_client, other_clinic):
        res = auth_client.patch(self.URL, {'email': other_clinic.email}, format='json')
        assert res.status_code == 400

    def test_unauthenticated(self, client):
        res = client.get(self.URL)
        assert res.status_code == 401


@pytest.mark.django_db
class TestChangePassword:
    URL = '/api/auth/change-password/'

    def test_change_success(self, auth_client):
        res = auth_client.post(self.URL, {'current_password': 'pass1234', 'new_password': 'newpass99'}, format='json')
        assert res.status_code == 200

    def test_wrong_current_password(self, auth_client):
        res = auth_client.post(self.URL, {'current_password': 'wrong', 'new_password': 'newpass99'}, format='json')
        assert res.status_code == 400

    def test_new_password_too_short(self, auth_client):
        res = auth_client.post(self.URL, {'current_password': 'pass1234', 'new_password': 'short'}, format='json')
        assert res.status_code == 400
