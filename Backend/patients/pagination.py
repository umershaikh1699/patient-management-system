from rest_framework.pagination import PageNumberPagination


# Default pagination for list endpoints (guarded max page size).
class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200
