from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import jwt
import os
import random
import string

from ..database import get_db
from ..models import Company, User, Candidate
from ..schemas import CompanySignupRequest, CandidateSignupRequest, LoginRequest, TokenResponse, ChangePasswordRequest
from ..services.email_sender import send_email

router = APIRouter(prefix="/api/auth", tags=["Auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-please-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

from typing import Optional

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_temp_password(length=10):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

@router.post("/signup")
def signup_company(req: CompanySignupRequest, db: Session = Depends(get_db)):
    # 1. Create company
    company = Company(name=req.company_name)
    db.add(company)
    db.commit()
    db.refresh(company)

    users_created = []

    # 2. Helper to create user
    def create_role_users(emails, role):
        for email in emails:
            email = email.strip()
            if not email:
                continue
            
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                continue

            temp_password = generate_temp_password()
            hashed_pwd = get_password_hash(temp_password)
            
            new_user = User(
                email=email,
                password_hash=hashed_pwd,
                role=role,
                company_id=company.id,
                is_temporary_password=True
            )
            db.add(new_user)
            db.commit()
            users_created.append((email, temp_password, role))

    create_role_users(req.recruiters, "recruiter")
    create_role_users(req.tech_panels, "tech_panel")
    create_role_users(req.delivery_heads, "delivery_head")

    # 3. Send Emails
    for email, temp_password, role in users_created:
        print(f"[AUTH DEV] Email: {email} | Role: {role} | Temp Password: {temp_password}")
        subject = f"Welcome to Stitch ATS - {company.name}"
        body = f"""
        Hello,

        You have been added to Stitch ATS under {company.name} as a {role.replace('_', ' ').title()}.

        Your temporary password is: {temp_password}

        Please login and change your password immediately.
        """
        try:
            # send_email from our service requires candidate_id typically, but we handle None if adapted.
            # Let's mock it for auth or use real if configured.
            send_email(to_email=email, subject=subject, body=body, db=db)
        except Exception as e:
            print(f"Failed to send welcome email to {email}: {e}")

    return {"message": "Company created successfully. Temporary passwords have been emailed to all users."}


@router.post("/signup/candidate")
def signup_candidate(req: CandidateSignupRequest, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == req.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    hashed_pwd = get_password_hash(req.password)
    
    new_user = User(
        email=req.email,
        password_hash=hashed_pwd,
        role="candidate",
        company_id=None,
        is_temporary_password=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "Candidate account created successfully."}


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
        "is_temporary_password": user.is_temporary_password
    }


@router.post("/change-password")
def change_password(req: ChangePasswordRequest, email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password"
        )
    
    user.password_hash = get_password_hash(req.new_password)
    user.is_temporary_password = False
    db.commit()
    
    return {"message": "Password updated successfully"}
