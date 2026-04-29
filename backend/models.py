from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, date


# ---- Auth Models ----
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "employee"  # admin or employee
    company_name: Optional[str] = None  # required for admin registration
    job_role: Optional[str] = None
    training_start_date: Optional[str] = None
    department: str = "HR"  # Production, Quality, Maintenance, HR
    primary_language: str = "en"  # en, hi, ta
    known_languages: list[str] = ["en"]  # subset of [en, hi, ta]



class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    primary_language: str = "en"
    known_languages: list[str] = ["en"]
    department: str = "HR"


# ---- Employee Models ----
class AddEmployeeRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    job_role: str
    training_start_date: Optional[str] = None
    date_of_joining: Optional[str] = None
    department: str = "HR"
    primary_language: str = "en"
    known_languages: list[str] = ["en"]



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


class MultilingualCourseCreate(BaseModel):
    title: dict  # {"en": "", "hi": "", "ta": ""}
    description: dict  # {"en": "", "hi": "", "ta": ""}
    youtube_link: dict  # {"en": "", "hi": "", "ta": ""}
    training_mode: str  # online, offline, self-paced, classroom
    category: str
    skills: list[str] = []
    duration_minutes: int = 0
    duration_days: int = 0
    generate_assessment: bool = False
    assessment_questions: list[dict] = []


class AssignCourseRequest(BaseModel):
    employee_id: str
    course_id: str


class AssignIndividualRequest(BaseModel):
    user_id: str
    course_id: str
    deadline_date: str  # ISO format datetime


class AssignDepartmentRequest(BaseModel):
    department: str
    course_id: str
    deadline_date: str


class AssignAllRequest(BaseModel):
    course_id: str
    deadline_date: str


class CompleteCourseRequest(BaseModel):
    course_id: str

class AssessmentSubmitRequest(BaseModel):
    course_id: str
    answers: list[int]


class LanguageUpdateRequest(BaseModel):
    selected_language: str  # en, hi, ta


# ---- Incentive Models ----
class IncentiveClaimRequest(BaseModel):
    incentive_id: str


class AssignEmployeesToSchemeRequest(BaseModel):
    employee_ids: list[str]


# ---- Course Update (single-language with auto-translate) ----
class CourseUpdateRequest(BaseModel):
    title: str
    description: str
    youtube_link: str = ""
    skills: list[str] = []
    duration_minutes: int = 0
    duration_days: int = 0
    source_lang: str = "en"  # the language the admin filled in
    training_mode: str = "online"
    category: str = "Safety"


# ---- Employee Update ----
class EmployeeUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    job_role: Optional[str] = None
    department: Optional[str] = None
    primary_language: Optional[str] = None


# ---- AI Generate Course Fields ----
class AIGenerateRequest(BaseModel):
    title: str
    description: str = ""
    source_lang: str = "en"


# ---- Translation Models ----
class TranslateRequest(BaseModel):
    texts: list[str]
    target_lang: str


# ---- Response Helpers ----
class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    job_role: Optional[str] = None
    company_id: Optional[str] = None
    training_start_date: Optional[str] = None
    department: Optional[str] = None
    primary_language: Optional[str] = None
    known_languages: Optional[list[str]] = None
