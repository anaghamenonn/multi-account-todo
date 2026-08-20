from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated

from .models import Todo
from .permissions import IsOwner
from .serializers import TodoSerializer


class TodoPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TodoViewSet(viewsets.ModelViewSet):
    """CRUD for the authenticated account's Todos.

    Every action (list/retrieve/create/update/partial_update/destroy) is
    scoped to `request.user`, the Account resolved from the validated
    Auth0 token by Auth0JWTAuthentication - never from a client-supplied
    id. See get_queryset() and perform_create().
    """

    serializer_class = TodoSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = TodoPagination
    search_fields = ['title']

    def get_queryset(self):
        queryset = Todo.objects.filter(account=self.request.user)

        status_filter = self.request.query_params.get('status')
        if status_filter == 'active':
            queryset = queryset.filter(completed=False)
        elif status_filter == 'completed':
            queryset = queryset.filter(completed=True)

        return queryset

    def perform_create(self, serializer):
        serializer.save(account=self.request.user)
