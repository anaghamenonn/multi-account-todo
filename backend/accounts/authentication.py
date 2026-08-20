import jwt
from django.conf import settings
from jwt import PyJWKClient
from rest_framework import authentication, exceptions

from .models import Account


class Auth0JWTAuthentication(authentication.BaseAuthentication):
    """Authenticates requests using an Auth0-issued RS256 access token.

    The token is never trusted to carry an account/user id. Instead:

    1. The token's signature, audience and issuer are verified against
       Auth0's public JWKS for AUTH0_DOMAIN.
    2. The verified `sub` claim (a stable, Auth0-assigned identifier) is
       used to look up - or lazily create - the local Account.
    3. That Account becomes `request.user` for the rest of the request,
       so every view can scope its queries to it.

    Nothing supplied by the client body/query params ever influences which
    account a request is authenticated as.
    """

    keyword = 'Bearer'

    def __init__(self):
        super().__init__()
        self._jwks_client = None

    def _get_jwks_client(self):
        if self._jwks_client is None:
            jwks_url = f'https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json'
            self._jwks_client = PyJWKClient(jwks_url)
        return self._jwks_client

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).decode('utf-8')
        if not auth_header:
            return None

        parts = auth_header.split()

        if parts[0].lower() != self.keyword.lower():
            return None
        if len(parts) == 1:
            raise exceptions.AuthenticationFailed('Invalid Authorization header: no credentials provided.')
        if len(parts) > 2:
            raise exceptions.AuthenticationFailed('Invalid Authorization header: token contains spaces.')

        token = parts[1]

        if not settings.AUTH0_DOMAIN or not settings.AUTH0_AUDIENCE:
            raise exceptions.AuthenticationFailed(
                'Auth0 is not configured on the server (AUTH0_DOMAIN / AUTH0_AUDIENCE missing).'
            )

        try:
            signing_key = self._get_jwks_client().get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=settings.AUTH0_ALGORITHMS,
                audience=settings.AUTH0_AUDIENCE,
                issuer=f'https://{settings.AUTH0_DOMAIN}/',
            )
        except jwt.PyJWTError as exc:
            raise exceptions.AuthenticationFailed(f'Invalid or expired token: {exc}') from exc

        sub = payload.get('sub')
        if not sub:
            raise exceptions.AuthenticationFailed('Token is missing the "sub" claim.')

        email = payload.get('email', '') or ''

        account, _created = Account.objects.get_or_create(
            auth0_user_id=sub,
            defaults={'email': email},
        )
        if email and account.email != email:
            account.email = email
            account.save(update_fields=['email'])

        return (account, token)

    def authenticate_header(self, request):
        # Presence of this makes DRF respond 401 (not 403) for missing/bad
        # credentials, per the assignment's error-handling requirements.
        return self.keyword
