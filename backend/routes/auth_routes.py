from fastapi import APIRouter, HTTPException, status
from models import RegisterRequest, LoginRequest, TokenResponse
from auth import hash_password, verify_password, create_token
from database import get_db
from bson import ObjectId

router = APIRouter(prefix="", tags=["Auth"])


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    db = get_db()

    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

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
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_token({"sub": user_id, "role": req.role})
    return TokenResponse(access_token=token, role=req.role, name=req.name)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token({"sub": str(user["_id"]), "role": user["role"]})
    return TokenResponse(access_token=token, role=user["role"], name=user["name"])
