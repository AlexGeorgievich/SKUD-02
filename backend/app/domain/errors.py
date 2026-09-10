class ServiceError(Exception):
    """Application failure mapped to HTTP only by the API adapter."""
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status
