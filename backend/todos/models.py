from django.db import models

from accounts.models import Account


class Todo(models.Model):
    account = models.ForeignKey(
        Account,
        related_name='todos',
        on_delete=models.CASCADE,
        help_text='Owning account. Set only by the server from the authenticated token.',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['account', 'completed']),
        ]

    def __str__(self):
        return self.title
