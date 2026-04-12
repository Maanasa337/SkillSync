from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ---- Auth Models ----
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "employee"  # admin or employee
    company_name: Optional[str] = None  # required for admin registration
    job_role: Optional[str] = None
    training_start_date: Optional[str] = None



class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str


# ---- Employee Models ----
class AddEmployeeRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    job_role: str
    training_start_date: Optional[str] = None



# ---- Course Models ----
class CourseCreate(BaseModel):
    title: str
    category: str  # Safety, Operations, Quality, etc.
    type: str  # mandatory / role-based
    linked_scheme: Optional[str] = None
    incentive_value: float = 0
    description: Optional[str] = None
    skills: list[str] = []
    youtube_url: Optional[str] = None
    duration_minutes: int = 0
    duration_days: int = 0



class AssignCourseRequest(BaseModel):
    employee_id: str
    course_id: str


class CompleteCourseRequest(BaseModel):
    course_id: str

class AssessmentSubmitRequest(BaseModel):
    course_id: str
    answers: list[int]



# ---- Incentive Models ----
class IncentiveClaimRequest(BaseModel):
    incentive_id: str


# ---- Response Helpers ----
class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    job_role: Optional[str] = None
    company_id: Optional[str] = None
    training_start_date: Optional[str] = None

