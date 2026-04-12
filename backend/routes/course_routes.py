from fastapi import APIRouter, Depends, HTTPException
from auth import require_role
from database import get_db
from bson import ObjectId

router = APIRouter(tags=["Courses"])

@router.get("/courses")
async def get_all_courses():
    # Publicly accessible list (or can require authentication, but generally available)
    db = get_db()
    courses = await db.courses.find({}).to_list(100)
    result = []
    for c in courses:
        result.append({
            "id": str(c["_id"]),
            "title": c["title"],
            "category": c["category"],
            "type": c["type"],
            "description": c.get("description", ""),
            "duration_minutes": c.get("duration_minutes", 0),
            "linked_scheme": c.get("linked_scheme"),
            "incentive_value": c.get("incentive_value", 0),
        })
    return result

@router.get("/courses/{course_id}")
async def get_course_detail(course_id: str):
    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    return {
        "id": str(course["_id"]),
        "title": course["title"],
        "category": course["category"],
        "type": course["type"],
        "description": course.get("description", ""),
        "skills": course.get("skills", []),
        "youtube_url": course.get("youtube_url", ""),
        "duration_minutes": course.get("duration_minutes", 0),
        "duration_days": course.get("duration_days", 0),
    }

@router.get("/courses/{course_id}/leaderboard")
async def get_course_leaderboard(course_id: str):
    db = get_db()
    
    # Get all progress records for this course that are completed
    progress_records = await db.progress.find({
        "course_id": course_id,
        "status": "completed"
    }).sort("score", -1).to_list(100) # Sort descending by score
    
    leaderboard = []
    for idx, p in enumerate(progress_records):
        user = await db.users.find_one({"_id": ObjectId(p["user_id"])})
        if user:
            # pass is >= 60
            status = "Pass" if p.get("score", 0) >= 60 else "Fail"
            leaderboard.append({
                "rank": idx + 1,
                "employee_name": user["name"],
                "employee_id": str(user["_id"]),
                "score": p.get("score", 0),
                "status": status
            })
            
    return leaderboard
