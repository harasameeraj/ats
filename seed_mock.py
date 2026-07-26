import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
from backend.models import Base, Company, User
from backend.database import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed():
    db = SessionLocal()
    
    # 1. Create a company
    company = Company(name="Tech Innovators Inc.")
    db.add(company)
    db.commit()
    db.refresh(company)
    
    # Define common password
    password_hash = pwd_context.hash("admin123")
    
    # 2. Create 2 HRs
    hr1 = User(email="hr1@techinnovators.com", role="recruiter", company_id=company.id, password_hash=password_hash, is_temporary_password=False)
    hr2 = User(email="hr2@techinnovators.com", role="recruiter", company_id=company.id, password_hash=password_hash, is_temporary_password=False)
    
    # 3. Create 2 Tech Panels
    tech1 = User(email="tech1@techinnovators.com", role="tech_panel", company_id=company.id, password_hash=password_hash, is_temporary_password=False)
    tech2 = User(email="tech2@techinnovators.com", role="tech_panel", company_id=company.id, password_hash=password_hash, is_temporary_password=False)
    
    # 4. Create 2 Delivery Heads
    delivery1 = User(email="delivery1@techinnovators.com", role="delivery_head", company_id=company.id, password_hash=password_hash, is_temporary_password=False)
    delivery2 = User(email="delivery2@techinnovators.com", role="delivery_head", company_id=company.id, password_hash=password_hash, is_temporary_password=False)
    
    db.add_all([hr1, hr2, tech1, tech2, delivery1, delivery2])
    db.commit()
    
    print("Successfully created mock company and users.")
    print("Company: Tech Innovators Inc.")
    print("Password for all users: admin123")
    print("HR Logins:")
    print(" - hr1@techinnovators.com")
    print(" - hr2@techinnovators.com")
    print("Tech Panel Logins:")
    print(" - tech1@techinnovators.com")
    print(" - tech2@techinnovators.com")
    print("Delivery Head Logins:")
    print(" - delivery1@techinnovators.com")
    print(" - delivery2@techinnovators.com")

if __name__ == "__main__":
    seed()
