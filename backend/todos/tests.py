"""
Backend test suite.

Auth0 is never called over the network in tests. Instead, we generate a
throwaway RSA keypair, sign access tokens with the private key, and patch
PyJWKClient.get_signing_key_from_jwt so the authentication class verifies
those tokens against our public key instead of fetching real JWKS. This
exercises the *real* Auth0JWTAuthentication code path (signature, issuer,
audience, `sub` -> Account resolution) without needing live Auth0
credentials.
"""

from types import SimpleNamespace
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Account
from .models import Todo

TEST_AUTH0_DOMAIN = 'test-tenant.us.auth0.com'
TEST_AUTH0_AUDIENCE = 'https://api.test.local'


def _generate_rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


# Generated once per test run - real Auth0 always uses RS256 with keys like this.
_PRIVATE_KEY, _PUBLIC_KEY = _generate_rsa_keypair()


def make_access_token(sub, email=None, audience=TEST_AUTH0_AUDIENCE, issuer=None, **extra_claims):
    payload = {
        'sub': sub,
        'iss': issuer or f'https://{TEST_AUTH0_DOMAIN}/',
        'aud': audience,
        **extra_claims,
    }
    if email:
        payload['email'] = email
    return jwt.encode(payload, _PRIVATE_KEY, algorithm='RS256', headers={'kid': 'test-key'})


@override_settings(AUTH0_DOMAIN=TEST_AUTH0_DOMAIN, AUTH0_AUDIENCE=TEST_AUTH0_AUDIENCE)
@patch('accounts.authentication.PyJWKClient.get_signing_key_from_jwt')
class TodoAPITests(TestCase):
    def _client_with_token(self, mock_get_key, token):
        mock_get_key.return_value = SimpleNamespace(key=_PUBLIC_KEY)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return client

    def _titles(self, response):
        return {todo['title'] for todo in response.data['results']}

    # -- Authentication -----------------------------------------------

    def test_unauthenticated_request_is_rejected(self, mock_get_key):
        client = APIClient()
        response = client.get('/api/todos/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_token_is_rejected(self, mock_get_key):
        mock_get_key.return_value = SimpleNamespace(key=_PUBLIC_KEY)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer not-a-real-token')
        response = client.get('/api/todos/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_for_wrong_audience_is_rejected(self, mock_get_key):
        token = make_access_token('auth0|user-a', audience='https://someone-elses-api')
        client = self._client_with_token(mock_get_key, token)
        response = client.get('/api/todos/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_first_request_lazily_creates_account(self, mock_get_key):
        self.assertEqual(Account.objects.count(), 0)
        token = make_access_token('auth0|new-user', email='new@example.com')
        client = self._client_with_token(mock_get_key, token)
        response = client.get('/api/todos/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Account.objects.count(), 1)
        account = Account.objects.get()
        self.assertEqual(account.auth0_user_id, 'auth0|new-user')
        self.assertEqual(account.email, 'new@example.com')

    # -- CRUD for one's own todos --------------------------------------

    def test_authenticated_user_can_create_todo(self, mock_get_key):
        token = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token)
        response = client.post('/api/todos/', {'title': 'Buy groceries', 'description': 'Milk and bread'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Todo.objects.count(), 1)
        todo = Todo.objects.get()
        self.assertEqual(todo.account.auth0_user_id, 'auth0|user-a')
        self.assertEqual(todo.title, 'Buy groceries')
        self.assertFalse(todo.completed)

    def test_blank_title_is_rejected(self, mock_get_key):
        token = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token)
        response = client.post('/api/todos/', {'title': '   '}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_authenticated_user_can_list_own_todos(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        Todo.objects.create(account=account_a, title='A1')
        Todo.objects.create(account=account_a, title='A2')

        token = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token)
        response = client.get('/api/todos/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._titles(response), {'A1', 'A2'})

    def test_list_only_returns_authenticated_users_todos(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        account_b = Account.objects.create(auth0_user_id='auth0|user-b')
        Todo.objects.create(account=account_a, title='A1')
        Todo.objects.create(account=account_a, title='A2')
        Todo.objects.create(account=account_b, title='B1')
        Todo.objects.create(account=account_b, title='B2')

        token_a = make_access_token('auth0|user-a')
        response_a = self._client_with_token(mock_get_key, token_a).get('/api/todos/')
        self.assertEqual(self._titles(response_a), {'A1', 'A2'})

        token_b = make_access_token('auth0|user-b')
        response_b = self._client_with_token(mock_get_key, token_b).get('/api/todos/')
        self.assertEqual(self._titles(response_b), {'B1', 'B2'})

    def test_authenticated_user_can_update_own_todo(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        todo = Todo.objects.create(account=account_a, title='Old title')

        token = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token)
        response = client.patch(f'/api/todos/{todo.id}/', {'completed': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        todo.refresh_from_db()
        self.assertTrue(todo.completed)

    def test_authenticated_user_can_delete_own_todo(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        todo = Todo.objects.create(account=account_a, title='Delete me')

        token = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token)
        response = client.delete(f'/api/todos/{todo.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Todo.objects.filter(id=todo.id).exists())

    # -- Cross-account isolation (the most important part) --------------

    def test_user_cannot_retrieve_another_users_todo(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        account_b = Account.objects.create(auth0_user_id='auth0|user-b')
        todo_b = Todo.objects.create(account=account_b, title='B secret')

        token_a = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token_a)
        response = client.get(f'/api/todos/{todo_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_update_another_users_todo(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        account_b = Account.objects.create(auth0_user_id='auth0|user-b')
        todo_b = Todo.objects.create(account=account_b, title='B secret')

        token_a = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token_a)
        response = client.patch(f'/api/todos/{todo_b.id}/', {'title': 'Hacked'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        todo_b.refresh_from_db()
        self.assertEqual(todo_b.title, 'B secret')

    def test_user_cannot_delete_another_users_todo(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        account_b = Account.objects.create(auth0_user_id='auth0|user-b')
        todo_b = Todo.objects.create(account=account_b, title='B secret')

        token_a = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token_a)
        response = client.delete(f'/api/todos/{todo_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Todo.objects.filter(id=todo_b.id).exists())

    def test_ownership_cannot_be_set_via_request_payload(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        account_b = Account.objects.create(auth0_user_id='auth0|user-b')

        token_a = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token_a)
        response = client.post(
            '/api/todos/',
            {'title': 'Sneaky', 'account': account_b.id, 'account_id': account_b.id, 'user_id': account_b.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        todo = Todo.objects.get(title='Sneaky')
        self.assertEqual(todo.account_id, account_a.id)

    def test_ownership_cannot_be_changed_via_patch(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        account_b = Account.objects.create(auth0_user_id='auth0|user-b')
        todo = Todo.objects.create(account=account_a, title='Mine')

        token_a = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token_a)
        response = client.patch(f'/api/todos/{todo.id}/', {'account': account_b.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        todo.refresh_from_db()
        self.assertEqual(todo.account_id, account_a.id)

    # -- Bonus: filtering --------------------------------------------

    def test_status_filter(self, mock_get_key):
        account_a = Account.objects.create(auth0_user_id='auth0|user-a')
        Todo.objects.create(account=account_a, title='Active one', completed=False)
        Todo.objects.create(account=account_a, title='Done one', completed=True)

        token = make_access_token('auth0|user-a')
        client = self._client_with_token(mock_get_key, token)

        response = client.get('/api/todos/?status=active')
        self.assertEqual(self._titles(response), {'Active one'})

        response = client.get('/api/todos/?status=completed')
        self.assertEqual(self._titles(response), {'Done one'})
