from fastapi import APIRouter, Depends, HTTPException, Query
from models import AddEmployeeRequest, AssignCourseRequest, IncentiveClaimRequest
from auth import hash_password, require_role
from database import get_db
from bson import ObjectId
from datetime import datetime
from typing import Optional
import math
from routes.course_routes import resolve_lang

router = APIRouter(tags=["Admin"])


@router.post("/employees/add")
async def add_employee(req: AddEmployeeRequest, user=Depends(require_role("admin"))):
    db = get_db()

    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Employee email already exists")

    employee = {
        "name": req.name,
        "email": req.email,
        "password": hash_password(req.password),
        "role": "employee",
        "company_id": user.get("company_id"),
        "job_role": req.job_role,
        "department": req.department,
        "primary_language": req.primary_language,
        "known_languages": req.known_languages,
    }

    if req.date_of_joining:
        employee["date_of_joining"] = req.date_of_joining

    result = await db.users.insert_one(employee)

    # Update company employee count
    if user.get("company_id"):
        await db.companies.update_one(
            {"_id": ObjectId(user["company_id"])},
            {"$inc": {"total_employees": 1}}
        )

    return {"message": "Employee added", "employee_id": str(result.inserted_id)}


def compute_experience_months(date_of_joining_str):
    """Compute experience_months dynamically: floor((current_date - date_of_joining).days / 30)"""
    if not date_of_joining_str:
        return 0
    try:
        doj = datetime.fromisoformat(date_of_joining_str)
        now = datetime.utcnow()
        days = (now - doj).days
        return max(0, math.floor(days / 30))
    except Exception:
        return 0


@router.get("/employees")
async def get_employees(
    status_filter: str = None,
    department: Optional[str] = Query(default=None),
    experience_range: Optional[str] = Query(default=None),
    sort_by: Optional[str] = Query(default="score"),
    user=Depends(require_role("admin"))
):
    db = get_db()
    query = {"role": "employee"}

    # Only filter by company_id if the admin has one
    if user.get("company_id"):
        query["company_id"] = user["company_id"]

    if department:
        query["department"] = department

    employees = await db.users.find(query).to_list(1000)

    result = []
    for emp in employees:
        emp_id = str(emp["_id"])

        # Compute experience_months dynamically
        experience_months = compute_experience_months(emp.get("date_of_joining"))

        # Apply experience_range filter
        if experience_range:
            if experience_range == "lt6" and experience_months >= 6:
                continue
            elif experience_range == "6to12" and (experience_months < 6 or experience_months >= 12):
                continue
            elif experience_range == "gt12" and experience_months < 12:
                continue

        progress_records = await db.progress.find({"user_id": emp_id}).to_list(100)

        assigned = len(progress_records)
        completed = sum(1 for p in progress_records if p["status"] == "completed")
        in_progress = sum(1 for p in progress_records if p["status"] == "in_progress")
        avg_score = 0
        if completed > 0:
            avg_score = round(sum(p.get("score", 0) for p in progress_records if p["status"] == "completed") / completed, 1)

        completion_pct = round((completed / assigned) * 100, 1) if assigned > 0 else 0

        if assigned == 0:
            emp_status = "not_started"
        elif completed == assigned:
            emp_status = "completed"
        elif in_progress > 0 or completed > 0:
            emp_status = "in_progress"
        else:
            emp_status = "not_started"

        if status_filter and emp_status != status_filter:
            continue

        result.append({
            "id": emp_id,
            "name": emp["name"],
            "email": emp["email"],
            "job_role": emp.get("job_role", ""),
            "department": emp.get("department", "HR"),
            "primary_language": emp.get("primary_language", "en"),
            "known_languages": emp.get("known_languages", ["en"]),
            "assigned_courses": assigned,
            "completed_courses": completed,
            "completion_pct": completion_pct,
            "status": emp_status,
            "score": avg_score,
            "date_of_joining": emp.get("date_of_joining"),
            "experience_months": experience_months,
        })

    # Sort results
    if sort_by == "name":
        result.sort(key=lambda x: x["name"].lower())
    else:
        # Default: score descending, then name alphabetical
        result.sort(key=lambda x: (-x["score"], x["name"].lower()))

    return result


@router.get("/employees/department-analytics")
async def department_analytics(user=Depends(require_role("admin"))):
    db = get_db()
    departments = ["Production", "Quality", "Maintenance", "HR"]

    analytics = []
    for dept in departments:
        query = {"role": "employee", "department": dept}
        if user.get("company_id"):
            query["company_id"] = user["company_id"]

        employees = await db.users.find(query).to_list(1000)
        emp_ids = [str(e["_id"]) for e in employees]
        total_employees = len(emp_ids)

        if total_employees == 0:
            analytics.append({
                "department": dept,
                "total_employees": 0,
                "avg_score": 0,
                "completion_pct": 0,
            })
            continue

        all_progress = await db.progress.find({
            "user_id": {"$in": emp_ids}
        }).to_list(10000)

        total_assignments = len(all_progress)
        completed = sum(1 for p in all_progress if p["status"] == "completed")
        scores = [p.get("score", 0) for p in all_progress if p["status"] == "completed" and p.get("score", 0) > 0]

        avg_score = round(sum(scores) / len(scores), 1) if scores else 0
        completion_pct = round((completed / total_assignments) * 100, 1) if total_assignments > 0 else 0

        analytics.append({
            "department": dept,
            "total_employees": total_employees,
            "avg_score": avg_score,
            "completion_pct": completion_pct,
        })

    return analytics


@router.get("/departments/{dept_name}/employees")
async def get_department_employees(dept_name: str, user=Depends(require_role("admin"))):
    """
    Returns employees in a department with:
    - name, course_completion_percent, avg_assessment_score, dept_rank
    Rank by avg_assessment_score desc, ties broken alphabetically.
    """
    db = get_db()
    query = {"role": "employee", "department": dept_name}
    if user.get("company_id"):
        query["company_id"] = user["company_id"]

    employees = await db.users.find(query).to_list(1000)

    if not employees:
        return []

    emp_results = []
    for emp in employees:
        emp_id = str(emp["_id"])
        progress_records = await db.progress.find({"user_id": emp_id}).to_list(100)

        assigned = len(progress_records)
        completed = sum(1 for p in progress_records if p["status"] == "completed")

        course_completion_percent = round((completed / assigned) * 100, 1) if assigned > 0 else 0

        scores = [p.get("score", 0) for p in progress_records if p["status"] == "completed" and p.get("score", 0) > 0]
        avg_assessment_score = round(sum(scores) / len(scores), 1) if scores else 0

        emp_results.append({
            "id": emp_id,
            "name": emp["name"],
            "course_completion_percent": course_completion_percent,
            "avg_assessment_score": avg_assessment_score,
        })

    # Sort by avg_assessment_score desc, then name alphabetically for ties
    emp_results.sort(key=lambda x: (-x["avg_assessment_score"], x["name"].lower()))

    # Assign ranks
    for idx, emp in enumerate(emp_results):
        emp["dept_rank"] = idx + 1

    return emp_results


@router.post("/courses/assign")
async def assign_course(req: AssignCourseRequest, user=Depends(require_role("admin"))):
    db = get_db()

    employee = await db.users.find_one({"_id": ObjectId(req.employee_id)})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    course = await db.courses.find_one({"_id": ObjectId(req.course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = await db.progress.find_one({
        "user_id": req.employee_id,
        "course_id": req.course_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Course already assigned")

    await db.progress.insert_one({
        "user_id": req.employee_id,
        "course_id": req.course_id,
        "status": "not_started",
        "score": 0,
        "completion_date": None,
        "assigned_date": datetime.utcnow().isoformat(),
    })

    return {"message": "Course assigned successfully"}


@router.get("/dashboard/admin")
async def admin_dashboard(lang: Optional[str] = Query(default="en"), user=Depends(require_role("admin"))):
    db = get_db()
    company_id = user.get("company_id")

    # Get all employees
    query = {"role": "employee"}
    if company_id:
        query["company_id"] = company_id

    employees = await db.users.find(query).to_list(1000)
    emp_ids = [str(e["_id"]) for e in employees]

    total_employees = len(emp_ids)

    # Get all progress for company employees
    all_progress = await db.progress.find({
        "user_id": {"$in": emp_ids}
    }).to_list(10000)

    completed_trainings = sum(1 for p in all_progress if p["status"] == "completed")
    pending_trainings = sum(1 for p in all_progress if p["status"] != "completed")

    # Get incentives
    incentive_query = {}
    if company_id:
        incentive_query["company_id"] = company_id
    incentives = await db.incentives.find(incentive_query).to_list(100)
    total_incentive = sum(i.get("claimable_amount", 0) for i in incentives if i.get("status") == "claimed")

    from routes.scheme_routes import calculate_months_between

    # Build incentive progress data
    incentive_progress = []
    for inc in incentives:
        scheme_courses = await db.courses.find({"linked_scheme": inc["scheme_name"]}).to_list(100)
        scheme_course_ids = [str(c["_id"]) for c in scheme_courses]

        eligible = 0
        pending_durations = 0

        for emp in employees:
            eid = str(emp["_id"])
            emp_progress = [p for p in all_progress if p["user_id"] == eid and p["course_id"] in scheme_course_ids]

            if emp_progress and all(p["status"] == "completed" and p.get("score", 0) >= 60 for p in emp_progress):
                months = calculate_months_between(emp.get("training_start_date"))
                if months >= 6.0:
                    eligible += 1
                else:
                    pending_durations += 1

        completion_pct = round((eligible / inc["required_count"]) * 100, 1) if inc.get("required_count", 0) > 0 else 0
        incentive_progress.append({
            "id": str(inc["_id"]),
            "scheme_name": inc["scheme_name"],
            "description": inc.get("description", ""),
            "benefit": inc.get("benefit", ""),
            "benefit_color": inc.get("benefit_color", "#16A34A"),
            "completion_pct": min(completion_pct, 100),
            "eligible_count": eligible,
            "required_count": inc.get("required_count", 0),
            "remaining": max(0, inc.get("required_count", 0) - eligible),
            "claimable_amount": inc.get("claimable_amount", 0),
            "status": inc.get("status", "pending"),
            "pending_duration_count": pending_durations
        })

    # Build course completion chart data
    all_courses = await db.courses.find({}).to_list(100)
    course_chart = []
    for c in all_courses:
        cid = str(c["_id"])
        total = sum(1 for p in all_progress if p["course_id"] == cid)
        done = sum(1 for p in all_progress if p["course_id"] == cid and p["status"] == "completed")
        if total > 0:
            course_chart.append({
                "course": resolve_lang(c.get("title", "Untitled"), lang),
                "completion_rate": round((done / total) * 100, 1),
                "completed": done,
                "total": total,
            })

    return {
        "overview": {
            "total_employees": total_employees,
            "completed_trainings": completed_trainings,
            "pending_trainings": pending_trainings,
            "total_incentive_earned": total_incentive,
        },
        "incentive_progress": incentive_progress,
        "course_chart": course_chart,
        "pie_data": {
            "completed": completed_trainings,
            "pending": pending_trainings,
        },
    }


@router.post("/incentive/claim")
async def claim_incentive(req: IncentiveClaimRequest, user=Depends(require_role("admin"))):
    db = get_db()

    incentive_query = {"_id": ObjectId(req.incentive_id)}
    if user.get("company_id"):
        incentive_query["company_id"] = user["company_id"]

    incentive = await db.incentives.find_one(incentive_query)
    if not incentive:
        raise HTTPException(status_code=404, detail="Incentive not found")
    if incentive["status"] == "claimed":
        raise HTTPException(status_code=400, detail="Already claimed")

    # Using the new robust eligibility rule (>= 6 months + all scheme courses passed)
    emp_query = {"role": "employee"}
    if user.get("company_id"):
        emp_query["company_id"] = user["company_id"]
    employees = await db.users.find(emp_query).to_list(1000)

    scheme_courses = await db.courses.find({"linked_scheme": incentive["scheme_name"]}).to_list(100)
    scheme_course_ids = [str(c["_id"]) for c in scheme_courses]

    eligible = 0
    from routes.scheme_routes import calculate_months_between

    for emp in employees:
        months = calculate_months_between(emp.get("training_start_date"))
        if months < 6.0:
            continue

        progress = await db.progress.find({
            "user_id": str(emp["_id"]),
            "course_id": {"$in": scheme_course_ids},
        }).to_list(100)

        if progress and all(p["status"] == "completed" and p.get("score", 0) >= 60 for p in progress):
            eligible += 1

    if eligible < incentive["required_count"]:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough eligible employees. Need {incentive['required_count']}, have {eligible}."
        )

    await db.incentives.update_one(
        {"_id": ObjectId(req.incentive_id)},
        {"$set": {"status": "claimed", "eligible_count": eligible, "claimed_date": datetime.utcnow().isoformat()}}
    )

    redirect_url = "https://apprenticeshipindia.gov.in"
    if incentive["scheme_name"] == "PMKVY":
        redirect_url = "https://www.pmkvyofficial.org/"

    return {
        "message": "Incentive claimed successfully",
        "amount": incentive["claimable_amount"],
        "redirect_url": redirect_url
    }
