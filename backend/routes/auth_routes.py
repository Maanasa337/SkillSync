from fastapi import APIRouter, HTTPException, status
from models import RegisterRequest, LoginRequest, TokenResponse
from auth import hash_password, verify_password, create_token
from database import get_db
from bson import ObjectId

router = APIRouter(prefix="", tags=["Auth"])

VALID_DEPARTMENTS = ["Production", "Quality", "Maintenance", "HR"]
VALID_LANGUAGES = ["en", "hi", "ta"]


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    db = get_db()

    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate department
    if req.department not in VALID_DEPARTMENTS:
        raise HTTPException(status_code=400, detail=f"Invalid department. Must be one of {VALID_DEPARTMENTS}")

    # Validate languages
    if req.primary_language not in VALID_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Invalid primary_language. Must be one of {VALID_LANGUAGES}")

    for lang in req.known_languages:
        if lang not in VALID_LANGUAGES:
            raise HTTPException(status_code=400, detail=f"Invalid language '{lang}' in known_languages")

    if req.primary_language not in req.known_languages:
        raise HTTPException(status_code=400, detail="known_languages must include primary_language")

    company_id = None
    if req.role == "admin":
        if not req.company_name:
            raise HTTPException(status_code=400, detail="Company name required for admin")
        company = await db.companies.insert_one({
            "name": req.company_name,
            "total_employees": 0,
        })
        company_id = str(company.inserted_id)

    user_doc = {
        "name": req.name,
        "email": req.email,
        "password": hash_password(req.password),
        "role": req.role,
        "company_id": company_id,
        "job_role": req.job_role or "",
        "department": req.department,
        "primary_language": req.primary_language,
        "known_languages": req.known_languages,
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_token({"sub": user_id, "role": req.role})
    return TokenResponse(
        access_token=token,
        role=req.role,
        name=req.name,
        primary_language=req.primary_language,
        known_languages=req.known_languages,
        department=req.department,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token({"sub": str(user["_id"]), "role": user["role"]})
    return TokenResponse(
        access_token=token,
        role=user["role"],
        name=user["name"],
        primary_language=user.get("primary_language", "en"),
        known_languages=user.get("known_languages", ["en"]),
        department=user.get("department", "HR"),
    )
