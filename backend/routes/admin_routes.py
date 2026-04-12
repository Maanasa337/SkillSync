from fastapi import APIRouter, Depends, HTTPException
from models import AddEmployeeRequest, AssignCourseRequest, IncentiveClaimRequest
from auth import hash_password, require_role
from database import get_db
from bson import ObjectId
from datetime import datetime

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
        "company_id": user["company_id"],
        "job_role": req.job_role,
    }
    result = await db.users.insert_one(employee)

    # Update company employee count
    await db.companies.update_one(
        {"_id": ObjectId(user["company_id"])},
        {"$inc": {"total_employees": 1}}
    )

    return {"message": "Employee added", "employee_id": str(result.inserted_id)}


@router.get("/employees")
async def get_employees(
    status_filter: str = None,
    user=Depends(require_role("admin"))
):
    db = get_db()
    employees = await db.users.find({
        "company_id": user["company_id"],
        "role": "employee"
    }).to_list(1000)

    result = []
    for emp in employees:
        emp_id = str(emp["_id"])
        progress_records = await db.progress.find({"user_id": emp_id}).to_list(100)
        
        assigned = len(progress_records)
        completed = sum(1 for p in progress_records if p["status"] == "completed")
        in_progress = sum(1 for p in progress_records if p["status"] == "in_progress")
        avg_score = 0
        if completed > 0:
            avg_score = round(sum(p.get("score", 0) for p in progress_records if p["status"] == "completed") / completed, 1)

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
            "assigned_courses": assigned,
            "completed_courses": completed,
            "status": emp_status,
            "score": avg_score,
        })

    return result


@router.post("/courses/assign")
async def assign_course(req: AssignCourseRequest, user=Depends(require_role("admin"))):
    db = get_db()

    employee = await db.users.find_one({"_id": ObjectId(req.employee_id)})
    if not employee or employee["company_id"] != user["company_id"]:
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
async def admin_dashboard(user=Depends(require_role("admin"))):
    db = get_db()
    company_id = user["company_id"]

    # Get all employees
    employees = await db.users.find({
        "company_id": company_id, "role": "employee"
    }).to_list(1000)
    emp_ids = [str(e["_id"]) for e in employees]

    total_employees = len(emp_ids)

    # Get all progress for company employees
    all_progress = await db.progress.find({
        "user_id": {"$in": emp_ids}
    }).to_list(10000)

    completed_trainings = sum(1 for p in all_progress if p["status"] == "completed")
    pending_trainings = sum(1 for p in all_progress if p["status"] != "completed")

    # Get incentives
    incentives = await db.incentives.find({"company_id": company_id}).to_list(100)
    total_incentive = sum(i.get("claimable_amount", 0) for i in incentives if i["status"] == "claimed")

    from routes.scheme_routes import calculate_months_between
    
    # Build incentive progress data
    incentive_progress = []
    for inc in incentives:
        scheme_courses = await db.courses.find({"linked_scheme": inc["scheme_name"]}).to_list(100)
        scheme_course_ids = [str(c["_id"]) for c in scheme_courses]
        
        eligible = 0
        pending_durations = 0 # Employees eligible via course but pending 6mo duration
        
        for emp in employees:
            eid = str(emp["_id"])
            emp_progress = [p for p in all_progress if p["user_id"] == eid and p["course_id"] in scheme_course_ids]
            
            # Must pass all assigned courses in the scheme
            if emp_progress and all(p["status"] == "completed" and p.get("score", 0) >= 60 for p in emp_progress):
                months = calculate_months_between(emp.get("training_start_date"))
                if months >= 6.0:
                    eligible += 1
                else:
                    pending_durations += 1

        completion_pct = round((eligible / inc["required_count"]) * 100, 1) if inc["required_count"] > 0 else 0
        incentive_progress.append({
            "id": str(inc["_id"]),
            "scheme_name": inc["scheme_name"],
            "completion_pct": min(completion_pct, 100),
            "eligible_count": eligible,
            "required_count": inc["required_count"],
            "remaining": max(0, inc["required_count"] - eligible),
            "claimable_amount": inc["claimable_amount"],
            "status": inc["status"],
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
                "course": c["title"],
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

    incentive = await db.incentives.find_one({
        "_id": ObjectId(req.incentive_id),
        "company_id": user["company_id"],
    })
    if not incentive:
        raise HTTPException(status_code=404, detail="Incentive not found")
    if incentive["status"] == "claimed":
        raise HTTPException(status_code=400, detail="Already claimed")

    # Using the new robust eligibility rule (>= 6 months + all scheme courses passed)
    employees = await db.users.find({
        "company_id": user["company_id"], "role": "employee"
    }).to_list(1000)
    
    scheme_courses = await db.courses.find({"linked_scheme": incentive["scheme_name"]}).to_list(100)
    scheme_course_ids = [str(c["_id"]) for c in scheme_courses]

    eligible = 0
    from routes.scheme_routes import calculate_months_between # Reuse duration logic
    
    for emp in employees:
        months = calculate_months_between(emp.get("training_start_date"))
        if months < 6.0:
            continue
            
        progress = await db.progress.find({
            "user_id": str(emp["_id"]),
            "course_id": {"$in": scheme_course_ids},
        }).to_list(100)
        
        # Must have assigned courses in scheme and passed all of them
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

    # Specific routing based on scheme as requested by user
    redirect_url = "https://apprenticeshipindia.gov.in"
    if incentive["scheme_name"] == "PMKVY":
        redirect_url = "https://www.pmkvyofficial.org/"

    return {
        "message": "Incentive claimed successfully", 
        "amount": incentive["claimable_amount"],
        "redirect_url": redirect_url
    }

