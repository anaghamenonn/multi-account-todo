from django.db import models


class Account(models.Model):
    """A registered application user, identified by their Auth0 subject.

    There is no password on this model and no custom auth system - Auth0
    is the sole identity provider. Rows are created lazily (get_or_create)
    the first time a validated access token for a given `auth0_user_id`
    is seen, so no separate signup endpoint is needed.
    """

    auth0_user_id = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="The 'sub' claim from the Auth0-issued access token.",
    )
    email = models.EmailField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.email or self.auth0_user_id

    # Duck-type the parts of Django's user protocol that DRF's
    # IsAuthenticated permission and request.user rely on, so an Account
    # instance can stand in as request.user without needing
    # django.contrib.auth.models.User at all.
    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False
