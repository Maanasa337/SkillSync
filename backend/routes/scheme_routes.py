from fastapi import APIRouter, Depends, HTTPException
from auth import require_role, get_current_user
from models import AssignEmployeesToSchemeRequest
from database import get_db
from bson import ObjectId
from datetime import datetime, timedelta

router = APIRouter(tags=["Schemes"])

def calculate_months_between(start_str: str) -> float:
    if not start_str:
        return 0
    try:
        start = datetime.fromisoformat(start_str)
        now = datetime.utcnow()
        days = (now - start).days
        return days / 30.0
    except:
        return 0

@router.get("/schemes/{scheme_name}/eligibility")
async def get_scheme_eligibility(scheme_name: str, user=Depends(require_role("admin"))):
    db = get_db()
    company_id = user["company_id"]
    scheme_name = scheme_name.upper()

    # Find the incentive
    incentive = await db.incentives.find_one({"company_id": company_id, "scheme_name": scheme_name})
    if not incentive:
        raise HTTPException(status_code=404, detail="Scheme not found for company")

    # Get scheme courses
    scheme_courses = await db.courses.find({"linked_scheme": scheme_name}).to_list(100)
    scheme_course_ids = [str(c["_id"]) for c in scheme_courses]

    if not scheme_course_ids:
        return {"eligible_count": 0, "pending_count": 0, "total_employees": 0}

    # Evaluate employees
    employees = await db.users.find({"company_id": company_id, "role": "employee"}).to_list(1000)
    
    eligible = []
    pending = []

    for emp in employees:
        emp_id = str(emp["_id"])
        
        # Rule 1: duration >= 6 months
        months = calculate_months_between(emp.get("training_start_date"))
        duration_met = months >= 6.0
        
        # Rule 2 & 3: Assigned courses under scheme completed, and passed (score > 0 and status completed)
        emp_progress = await db.progress.find({
            "user_id": emp_id,
            "course_id": {"$in": scheme_course_ids}
        }).to_list(100)
        
        has_assigned_in_scheme = len(emp_progress) > 0
        all_completed = has_assigned_in_scheme and all(p["status"] == "completed" and p.get("score", 0) >= 60 for p in emp_progress)

        if duration_met and all_completed:
            eligible.append(emp_id)
        else:
            pending.append({
                "id": emp_id,
                "reasons": {
                    "duration_met": duration_met,
                    "months": round(months, 1),
                    "courses_assigned": has_assigned_in_scheme,
                    "courses_completed": all_completed
                }
            })

    return {
        "scheme_name": scheme_name,
        "eligible_count": len(eligible),
        "pending_count": len(pending),
        "required_count": incentive["required_count"],
        "claimable_amount": incentive["claimable_amount"],
        "status": incentive["status"],
        "eligible_employee_ids": eligible,
        "pending_employee_details": pending
    }


@router.get("/schemes/{scheme_name}/employees")
async def get_scheme_employees(scheme_name: str, status: str = "eligible", user=Depends(require_role("admin"))):
    # status can be "eligible" or "pending"
    db = get_db()
    company_id = user["company_id"]
    scheme_name = scheme_name.upper()

    # Get scheme courses to count
    scheme_courses = await db.courses.find({"linked_scheme": scheme_name}).to_list(100)
    scheme_course_ids = [str(c["_id"]) for c in scheme_courses]

    # Evaluate eligibility like above
    employees = await db.users.find({"company_id": company_id, "role": "employee"}).to_list(1000)
    
    result = []

    for emp in employees:
        emp_id = str(emp["_id"])
        months = calculate_months_between(emp.get("training_start_date"))
        duration_met = months >= 6.0
        
        emp_progress = await db.progress.find({"user_id": emp_id}).to_list(100)
        
        scheme_progress = [p for p in emp_progress if p["course_id"] in scheme_course_ids]
        
        has_assigned_in_scheme = len(scheme_progress) > 0
        completed_in_scheme = sum(1 for p in scheme_progress if p["status"] == "completed" and p.get("score", 0) >= 60)
        
        all_completed = has_assigned_in_scheme and completed_in_scheme == len(scheme_progress)

        is_eligible = duration_met and all_completed

        if (status == "eligible" and is_eligible) or (status == "pending" and not is_eligible):
            avg_score = 0
            if completed_in_scheme > 0:
                avg_score = round(sum(p.get("score", 0) for p in scheme_progress if p["status"] == "completed") / completed_in_scheme, 1)

            entry = {
                "id": emp_id,
                "name": emp["name"],
                "role": emp.get("job_role", "Employee"),
                "duration_months": round(months, 1),
                "courses_completed": f"{completed_in_scheme}/{len(scheme_progress)}" if len(scheme_progress) > 0 else "0/0",
                "score": avg_score,
                "status": "Eligible" if is_eligible else "Pending",
            }
            if not is_eligible:
                reasons = []
                if not duration_met: reasons.append(f"Insufficient duration ({round(months, 1)}m / 6m)")
                if not all_completed: reasons.append("Incomplete scheme courses")
                entry["missing_requirements"] = ", ".join(reasons)
                
            result.append(entry)

    return result


@router.get("/incentives/details")
async def get_incentive_details(user=Depends(require_role("admin"))):
    """
    Returns all schemes with stored fields plus computed assigned/completed/pending employees.
    """
    db = get_db()
    company_id = user.get("company_id")

    incentive_query = {}
    if company_id:
        incentive_query["company_id"] = company_id

    incentives = await db.incentives.find(incentive_query).to_list(100)

    # Get all employees
    emp_query = {"role": "employee"}
    if company_id:
        emp_query["company_id"] = company_id
    all_employees = await db.users.find(emp_query).to_list(1000)
    emp_map = {str(e["_id"]): e for e in all_employees}

    # Get all progress
    all_emp_ids = list(emp_map.keys())
    all_progress = await db.progress.find({"user_id": {"$in": all_emp_ids}}).to_list(10000)

    # Index progress by user_id
    progress_by_user = {}
    for p in all_progress:
        uid = p["user_id"]
        if uid not in progress_by_user:
            progress_by_user[uid] = []
        progress_by_user[uid].append(p)

    result = []
    for inc in incentives:
        scheme_name = inc["scheme_name"]

        # Get scheme courses
        scheme_courses = await db.courses.find({"linked_scheme": scheme_name}).to_list(100)
        scheme_course_ids = [str(c["_id"]) for c in scheme_courses]

        assigned_ids = inc.get("assigned_employee_ids", [])
        # Convert ObjectIds to strings if needed
        assigned_id_strs = [str(aid) for aid in assigned_ids]

        assigned_employees = []
        completed_employees = []
        pending_employees = []

        for emp_id_str in assigned_id_strs:
            emp = emp_map.get(emp_id_str)
            if not emp:
                continue

            emp_progress = progress_by_user.get(emp_id_str, [])
            scheme_progress = [p for p in emp_progress if p["course_id"] in scheme_course_ids]

            assigned_count = len(scheme_progress)
            completed_count = sum(1 for p in scheme_progress if p["status"] == "completed")
            all_passed = assigned_count > 0 and all(
                p["status"] == "completed" and p.get("score", 0) >= 60 for p in scheme_progress
            )

            completion_pct = round((completed_count / assigned_count) * 100, 1) if assigned_count > 0 else 0

            scores = [p.get("score", 0) for p in scheme_progress if p["status"] == "completed"]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0

            emp_entry = {
                "id": emp_id_str,
                "name": emp["name"],
                "dept": emp.get("department", "HR"),
                "completion_status": completion_pct,
                "score": avg_score,
                "status": "Completed" if all_passed else "Pending",
            }

            assigned_employees.append(emp_entry)

            if all_passed:
                completed_employees.append(emp_entry)
            else:
                pending_employees.append(emp_entry)

        result.append({
            "id": str(inc["_id"]),
            "scheme_name": scheme_name,
            "required_count": inc.get("required_count", 0),
            "claimable_amount": inc.get("claimable_amount", 0),
            "status": inc.get("status", "pending"),
            "min_employees_required": inc.get("min_employees_required", 0),
            "min_training_duration_months": inc.get("min_training_duration_months", 0),
            "assigned_employees": assigned_employees,
            "completed_employees": completed_employees,
            "pending_employees": pending_employees,
        })

    return result


@router.post("/incentives/{scheme_id}/assign-employees")
async def assign_employees_to_scheme(
    scheme_id: str,
    req: AssignEmployeesToSchemeRequest,
    user=Depends(require_role("admin")),
):
    """
    Append employee_ids to scheme's assigned_employee_ids (no duplicates).
    """
    db = get_db()

    incentive = await db.incentives.find_one({"_id": ObjectId(scheme_id)})
    if not incentive:
        raise HTTPException(status_code=404, detail="Incentive scheme not found")

    existing_ids = [str(eid) for eid in incentive.get("assigned_employee_ids", [])]

    new_ids = []
    for eid in req.employee_ids:
        # Validate employee exists
        emp = await db.users.find_one({"_id": ObjectId(eid), "role": "employee"})
        if not emp:
            raise HTTPException(status_code=404, detail=f"Employee {eid} not found")
        if eid in existing_ids:
            continue  # Skip already assigned
        new_ids.append(eid)

    if new_ids:
        await db.incentives.update_one(
            {"_id": ObjectId(scheme_id)},
            {"$push": {"assigned_employee_ids": {"$each": [ObjectId(eid) for eid in new_ids]}}}
        )

    return {"message": f"{len(new_ids)} employees assigned to scheme", "assigned_count": len(new_ids)}
