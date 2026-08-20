from rest_framework import serializers

from .models import Todo


class TodoSerializer(serializers.ModelSerializer):
    """Serializes Todo objects.

    Deliberately excludes `account` from `fields`: it is never accepted as
    input and never exposed as output. Ownership is assigned server-side in
    TodoViewSet.perform_create() from the authenticated request, so a
    client cannot set or change it - even by including "account" or
    "account_id" in the request body.
    """

    class Meta:
        model = Todo
        fields = ['id', 'title', 'description', 'completed', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Title cannot be blank.')
        if len(value) > 255:
            raise serializers.ValidationError('Title cannot exceed 255 characters.')
        return value
