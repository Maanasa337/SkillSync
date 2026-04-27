from fastapi import APIRouter, Depends, HTTPException
from models import AssignIndividualRequest, AssignDepartmentRequest, AssignAllRequest
from auth import require_role
from database import get_db
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/assignments", tags=["Assignments"])


async def create_assignment(db, user_id: str, course_id: str, deadline_date: str):
    """Create a single assignment, skip if already exists. Returns True if created."""
    existing = await db.progress.find_one({
        "user_id": user_id,
        "course_id": course_id,
    })
    if existing:
        return False  # Already assigned, skip

    # Get user and course for language mapping
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    course = await db.courses.find_one({"_id": ObjectId(course_id)})

    if not user or not course:
        return False

    # Determine preferred language for this assignment
    # Check if the course has multilingual content
    user_known = user.get("known_languages", ["en"])
    user_primary = user.get("primary_language", "en")

    # The "default" language of the course is "en"
    # If "en" is in user's known languages, serve in "en" (or their preferred)
    # If not, serve in user's primary_language
    preferred_lang = user_primary

    await db.progress.insert_one({
        "user_id": user_id,
        "course_id": course_id,
        "status": "not_started",
        "score": 0,
        "completed_at": None,
        "assigned_date": datetime.utcnow().isoformat(),
        "deadline_date": deadline_date,
        "preferred_lang": preferred_lang,
    })
    return True


@router.post("/assign-individual")
async def assign_individual(req: AssignIndividualRequest, user=Depends(require_role("admin"))):
    db = get_db()

    # Validate user exists and is an employee
    employee = await db.users.find_one({"_id": ObjectId(req.user_id), "role": "employee"})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Validate course exists
    course = await db.courses.find_one({"_id": ObjectId(req.course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    created = await create_assignment(db, req.user_id, req.course_id, req.deadline_date)
    if not created:
        raise HTTPException(status_code=400, detail="Course already assigned to this employee")

    return {"message": "Course assigned successfully", "assigned_count": 1}


@router.post("/assign-department")
async def assign_department(req: AssignDepartmentRequest, user=Depends(require_role("admin"))):
    db = get_db()

    valid_depts = ["Production", "Quality", "Maintenance", "HR"]
    if req.department not in valid_depts:
        raise HTTPException(status_code=400, detail=f"Invalid department. Must be one of {valid_depts}")

    course = await db.courses.find_one({"_id": ObjectId(req.course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    employees = await db.users.find({
        "role": "employee",
        "department": req.department
    }).to_list(1000)

    count = 0
    for emp in employees:
        created = await create_assignment(db, str(emp["_id"]), req.course_id, req.deadline_date)
        if created:
            count += 1

    return {"message": f"Course assigned to {count} employees in {req.department}", "assigned_count": count}


@router.post("/assign-all")
async def assign_all(req: AssignAllRequest, user=Depends(require_role("admin"))):
    db = get_db()

    course = await db.courses.find_one({"_id": ObjectId(req.course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    employees = await db.users.find({"role": "employee"}).to_list(10000)

    count = 0
    for emp in employees:
        created = await create_assignment(db, str(emp["_id"]), req.course_id, req.deadline_date)
        if created:
            count += 1

    return {"message": f"Course assigned to {count} employees", "assigned_count": count}
