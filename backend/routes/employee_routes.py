from fastapi import APIRouter, Depends, HTTPException
from models import CompleteCourseRequest
from auth import require_role
from database import get_db
from bson import ObjectId
from datetime import datetime

router = APIRouter(tags=["Employee"])


@router.get("/courses/my")
async def my_courses(user=Depends(require_role("employee"))):
    db = get_db()
    user_id = user["_id"]

    progress_records = await db.progress.find({"user_id": user_id}).to_list(100)

    courses = []
    for p in progress_records:
        course = await db.courses.find_one({"_id": ObjectId(p["course_id"])})
        if course:
            courses.append({
                "progress_id": str(p["_id"]),
                "course_id": str(course["_id"]),
                "title": course["title"],
                "category": course["category"],
                "type": course["type"],
                "status": p["status"],
                "score": p.get("score", 0),
                "completion_date": p.get("completion_date"),
                "assigned_date": p.get("assigned_date"),
            })

    return courses


@router.get("/dashboard/employee")
async def employee_dashboard(user=Depends(require_role("employee"))):
    db = get_db()
    user_id = user["_id"]

    progress_records = await db.progress.find({"user_id": user_id}).to_list(100)

    total_courses = len(progress_records)
    completed = sum(1 for p in progress_records if p["status"] == "completed")
    in_progress = sum(1 for p in progress_records if p["status"] == "in_progress")
    
    avg_score = 0
    if completed > 0:
        avg_score = round(
            sum(p.get("score", 0) for p in progress_records if p["status"] == "completed") / completed, 1
        )

    completion_pct = round((completed / total_courses) * 100, 1) if total_courses > 0 else 0

    # Courses with details
    courses = []
    completed_categories = set()
    for p in progress_records:
        course = await db.courses.find_one({"_id": ObjectId(p["course_id"])})
        if course:
            courses.append({
                "course_id": str(course["_id"]),
                "title": course["title"],
                "category": course["category"],
                "type": course["type"],
                "status": p["status"],
                "score": p.get("score", 0),
                "completion_date": p.get("completion_date"),
                "description": course.get("description", ""),
                "skills": course.get("skills", []),
                "duration_minutes": course.get("duration_minutes", 0),
                "youtube_url": course.get("youtube_url", "")
            })
            if p["status"] == "completed":
                completed_categories.add(course["category"])

    # Growth Insights
    growth_insights = []
    category_map = {
        frozenset(["Safety"]): "Safety Specialist Track",
        frozenset(["Operations"]): "Operations Excellence Track",
        frozenset(["Safety", "Operations"]): "Advanced Manufacturing Certification",
        frozenset(["Quality"]): "Quality Control Expert Track",
        frozenset(["Safety", "Quality"]): "Compliance & Safety Leadership",
        frozenset(["Operations", "Quality"]): "Process Optimization Track",
        frozenset(["Safety", "Operations", "Quality"]): "Master Manufacturing Professional",
    }
    
    for cats, track in category_map.items():
        if cats.issubset(completed_categories):
            growth_insights.append({
                "track": track,
                "categories_completed": list(cats),
                "message": f"Completed {' + '.join(cats)} → Eligible for {track}",
            })

    # Certificates
    certificates = []
    for p in progress_records:
        if p["status"] == "completed":
            course = await db.courses.find_one({"_id": ObjectId(p["course_id"])})
            if course:
                certificates.append({
                    "course_id": str(course["_id"]),
                    "title": course["title"],
                    "completion_date": p.get("completion_date"),
                    "score": p.get("score", 0),
                })

    # Notifications
    notifications = []
    for p in progress_records:
        if p["status"] == "not_started":
            course = await db.courses.find_one({"_id": ObjectId(p["course_id"])})
            if course:
                notifications.append({
                    "type": "assignment",
                    "message": f"New course assigned: {course['title']}",
                    "course_id": str(course["_id"]),
                })
        elif p["status"] == "in_progress":
            course = await db.courses.find_one({"_id": ObjectId(p["course_id"])})
            if course:
                notifications.append({
                    "type": "deadline",
                    "message": f"Complete '{course['title']}' soon",
                    "course_id": str(course["_id"]),
                })

    return {
        "progress": {
            "total_courses": total_courses,
            "completed": completed,
            "in_progress": in_progress,
            "completion_pct": completion_pct,
            "avg_score": avg_score,
        },
        "courses": courses,
        "growth_insights": growth_insights,
        "certificates": certificates,
        "notifications": notifications,
    }
