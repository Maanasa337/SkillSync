from fastapi import APIRouter, Depends, HTTPException, Query
from auth import require_role, get_current_user
from models import MultilingualCourseCreate
from database import get_db
from bson import ObjectId
from typing import Optional
from utils.bhashini import translate
import asyncio

router = APIRouter(tags=["Courses"])


def resolve_lang(field, lang: str = "en") -> str:
    """Resolve a multilingual field. Handles both dict and plain string formats."""
    if isinstance(field, dict):
        val = field.get(lang, "")
        if not val:
            val = field.get("en", "")
        if not val:
            # Return first non-empty value
            for v in field.values():
                if v:
                    return v
        return val or ""
    return field or ""

async def resolve_and_translate(field, lang: str = "en") -> str:
    """Resolve a multilingual field. Translate dynamically if target lang is missing."""
    if isinstance(field, dict):
        val = field.get(lang, "")
        if val: return val
        
        # fallback to English
        en_val = field.get("en", "")
        if not en_val:
            for v in field.values():
                if v:
                    en_val = v
                    break
        
        # dynamically translate the fallback
        if en_val and lang != "en":
            try:
                return await translate(en_val, "en", lang)
            except:
                pass
        return en_val or ""
    
    # if it's a string
    if field and lang != "en":
        try:
            return await translate(field, "en", lang)
        except:
            pass
    return field or ""


@router.post("/courses")
async def create_course(req: MultilingualCourseCreate, user=Depends(require_role("admin"))):
    db = get_db()

    valid_modes = ["online", "offline", "self-paced", "classroom"]
    if req.training_mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid training_mode. Must be one of {valid_modes}")

    course_doc = {
        "title": req.title,
        "description": req.description,
        "youtube_link": req.youtube_link,
        "training_mode": req.training_mode,
        "category": req.category,
        # Keep backward compat fields
        "type": "mandatory",
        "skills": [],
        "duration_minutes": 0,
        "duration_days": 0,
        "linked_scheme": None,
        "incentive_value": 0,
    }
    result = await db.courses.insert_one(course_doc)
    return {"message": "Course created successfully", "course_id": str(result.inserted_id)}


@router.get("/courses")
async def get_all_courses(lang: Optional[str] = Query(default="en")):
    db = get_db()
    courses = await db.courses.find({}).to_list(100)
    result = []
    
    # Pre-translate skills for all courses concurrently
    async def translate_skills(skills, target_lang):
        if target_lang == "en" or not skills:
            return skills
        try:
            return await asyncio.gather(*(translate(s, "en", target_lang) for s in skills))
        except:
            return skills

    for c in courses:
        translated_skills = await translate_skills(c.get("skills", []), lang)
        result.append({
            "id": str(c["_id"]),
            "title": await resolve_and_translate(c.get("title", ""), lang),
            "category": c.get("category", ""),
            "type": c.get("type", "mandatory"),
            "description": await resolve_and_translate(c.get("description", ""), lang),
            "skills": translated_skills,
            "duration_minutes": c.get("duration_minutes", 0),
            "linked_scheme": c.get("linked_scheme"),
            "incentive_value": c.get("incentive_value", 0),
            "training_mode": c.get("training_mode", "online"),
            "youtube_link": resolve_lang(c.get("youtube_link", c.get("youtube_url", "")), lang),
            "youtube_url": resolve_lang(c.get("youtube_url", c.get("youtube_link", "")), lang),
            # Also provide raw multilingual fields for admin
            "title_ml": c.get("title") if isinstance(c.get("title"), dict) else None,
            "description_ml": c.get("description") if isinstance(c.get("description"), dict) else None,
            "youtube_link_ml": c.get("youtube_link") if isinstance(c.get("youtube_link"), dict) else None,
        })
    return result


@router.get("/courses/{course_id}")
async def get_course_detail(course_id: str, lang: Optional[str] = Query(default="en")):
    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    skills = course.get("skills", [])
    if lang != "en" and skills:
        try:
            skills = await asyncio.gather(*(translate(s, "en", lang) for s in skills))
        except:
            pass

    return {
        "id": str(course["_id"]),
        "title": await resolve_and_translate(course.get("title", ""), lang),
        "category": course.get("category", ""),
        "type": course.get("type", "mandatory"),
        "description": await resolve_and_translate(course.get("description", ""), lang),
        "skills": skills,
        "youtube_link": resolve_lang(course.get("youtube_link", ""), lang),
        "duration_minutes": course.get("duration_minutes", 0),
        "duration_days": course.get("duration_days", 0),
        "training_mode": course.get("training_mode", "online"),
    }


@router.get("/courses/{course_id}/leaderboard")
async def get_course_leaderboard(course_id: str):
    db = get_db()

    # Get all progress records for this course that are completed
    progress_records = await db.progress.find({
        "course_id": course_id,
        "status": "completed"
    }).sort("score", -1).to_list(100)  # Sort descending by score

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
