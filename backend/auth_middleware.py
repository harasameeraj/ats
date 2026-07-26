from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import jwt
from .tenant import current_company_id
from .database import SessionLocal
from .models import User
import os

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-please-change-in-prod")
ALGORITHM = "HS256"

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        company_id_set = False
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                email = payload.get("sub")
                if email:
                    db = SessionLocal()
                    user = db.query(User).filter(User.email == email).first()
                    db.close()
                    if user and user.company_id:
                        current_company_id.set(user.company_id)
                        company_id_set = True
            except Exception:
                pass
        
        response = await call_next(request)
        
        # Reset ContextVar to prevent cross-request leakage in async environments
        if company_id_set:
            current_company_id.set(None)
            
        return response
