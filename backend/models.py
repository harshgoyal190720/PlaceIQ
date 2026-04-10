from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    role: str
    name: str


class StudentProfile(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    name: str
    email: EmailStr
    branch: str
    cgpa: float
    skills: List[str]
    projects: int
    internships: int
    backlogs: int
    year: int
    applications_count: int
    offers: int
    status: str


class Company(BaseModel):
    id: str = Field(alias="_id")
    name: str
    package: float
    required_cgpa: float
    required_skills: List[str]
    sector: str
    rounds: int


class Application(BaseModel):
    id: str = Field(alias="_id")
    student_id: str
    company_id: str
    status: str
    applied_on: Optional[str] = None
