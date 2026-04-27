from fastapi import APIRouter, Depends, HTTPException, Query
from models import CompleteCourseRequest, LanguageUpdateRequest
from auth import require_role, get_current_user
from database import get_db
from bson import ObjectId
from datetime import datetime
from typing import Optional
from routes.course_routes import resolve_lang

router = APIRouter(tags=["Employee"])


@router.get("/courses/my")
async def my_courses(lang: Optional[str] = Query(default=None), user=Depends(require_role("employee"))):
    db = get_db()
    user_id = user["_id"]
    user_primary = user.get("primary_language", "en")

    # Language priority: explicit lang param > user primary_language > "en"
    requested_lang = lang or user_primary or "en"

    progress_records = await db.progress.find({"user_id": user_id}).to_list(100)

    courses = []
    for p in progress_records:
        course = await db.courses.find_one({"_id": ObjectId(p["course_id"])})
        if course:
            courses.append({
                "progress_id": str(p["_id"]),
                "course_id": str(course["_id"]),
                "title": resolve_lang(course.get("title", ""), requested_lang),
                "category": course.get("category", ""),
                "type": course.get("type", "mandatory"),
                "status": p["status"],
                "score": p.get("score", 0),
                "completion_date": p.get("completion_date"),
                "assigned_date": p.get("assigned_date"),
                "deadline_date": p.get("deadline_date"),
                "training_mode": course.get("training_mode", "online"),
                "description": resolve_lang(course.get("description", ""), requested_lang),
                "skills": course.get("skills", []),
                "youtube_link": resolve_lang(course.get("youtube_link", ""), requested_lang),
            })

    return courses


@router.get("/dashboard/employee")
async def employee_dashboard(lang: Optional[str] = Query(default=None), user=Depends(require_role("employee"))):
    db = get_db()
    user_id = user["_id"]
    user_primary = user.get("primary_language", "en")

    # Language priority: explicit lang param > user primary_language > "en"
    requested_lang = lang or user_primary or "en"

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
                "title": resolve_lang(course.get("title", ""), requested_lang),
                "category": course.get("category", ""),
                "type": course.get("type", "mandatory"),
                "status": p["status"],
                "score": p.get("score", 0),
                "completion_date": p.get("completion_date", p.get("completed_at")),
                "description": resolve_lang(course.get("description", ""), requested_lang),
                "skills": course.get("skills", []),
                "duration_minutes": course.get("duration_minutes", 0),
                "duration_days": course.get("duration_days", 0),
                "youtube_link": resolve_lang(course.get("youtube_link", ""), requested_lang),
                "assigned_date": p.get("assigned_date"),
                "deadline_date": p.get("deadline_date"),
                "training_mode": course.get("training_mode", "online"),
            })
            if p["status"] == "completed":
                completed_categories.add(course.get("category", ""))

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
                    "title": resolve_lang(course.get("title", ""), requested_lang),
                    "completion_date": p.get("completion_date", p.get("completed_at")),
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
                    "message": f"New course assigned: {resolve_lang(course.get('title', ''), requested_lang)}",
                    "course_id": str(course["_id"]),
                })
        elif p["status"] == "in_progress":
            course = await db.courses.find_one({"_id": ObjectId(p["course_id"])})
            if course:
                notifications.append({
                    "type": "deadline",
                    "message": f"Complete '{resolve_lang(course.get('title', ''), requested_lang)}' soon",
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


@router.patch("/users/me/language")
async def update_language(req: LanguageUpdateRequest, user=Depends(get_current_user)):
    db = get_db()

    valid_languages = ["en", "hi", "ta"]
    if req.selected_language not in valid_languages:
        raise HTTPException(status_code=400, detail=f"Invalid language. Must be one of {valid_languages}")

    known = user.get("known_languages", ["en"])
    if req.selected_language not in known:
        raise HTTPException(
            status_code=400,
            detail=f"Language '{req.selected_language}' is not in your known languages: {known}"
        )

    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"primary_language": req.selected_language}}
    )

    return {"message": "Language updated successfully", "selected_language": req.selected_language}
