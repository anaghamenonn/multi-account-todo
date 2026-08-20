from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Object-level check that a Todo belongs to the requesting account.

    TodoViewSet.get_queryset() already scopes every list/detail/update/
    delete query to `request.user` (the authenticated Account), so
    get_object() should never surface another account's Todo in the first
    place - a mismatched id simply 404s. This permission is defense in
    depth against that queryset filter ever being loosened or bypassed.
    """

    def has_object_permission(self, request, view, obj):
        return obj.account_id == request.user.id
