from fastapi import APIRouter, Depends, HTTPException, Query
from auth import require_role, get_current_user
from models import MultilingualCourseCreate, CourseUpdateRequest, AIGenerateRequest
from database import get_db
from bson import ObjectId
from typing import Optional
from utils.bhashini import translate
from routers.chatbot import call_gemini_with_fallback
import asyncio
import json
import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Courses"])

ALL_LANGS = ["en", "hi", "ta"]


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


async def _translate_to_all_langs(text: str, source_lang: str) -> dict:
    """Translate a text from source_lang to all 3 languages, returning {en: ..., hi: ..., ta: ...}."""
    result = {}
    for lang in ALL_LANGS:
        if lang == source_lang:
            result[lang] = text
        else:
            try:
                result[lang] = await translate(text, source_lang, lang)
            except Exception:
                result[lang] = text  # fallback to original
    return result


async def _generate_youtube_links_for_langs(title: str, source_lang: str, source_link: str) -> dict:
    """Use Gemini to find relevant YouTube video links in other languages."""
    other_langs = [l for l in ALL_LANGS if l != source_lang]
    lang_names = {"en": "English", "hi": "Hindi", "ta": "Tamil"}

    result = {source_lang: source_link}

    if not source_link or not other_langs:
        for l in ALL_LANGS:
            if l not in result:
                result[l] = source_link or ""
        return result

    prompt = f"""Given this training course title: "{title}"
And its YouTube video link in {lang_names.get(source_lang, source_lang)}: {source_link}

Find equivalent YouTube tutorial/training video links for these languages: {', '.join(lang_names.get(l, l) for l in other_langs)}.
Return ONLY a JSON object with language codes as keys and YouTube URLs as values.
If you cannot find an exact equivalent, provide the closest relevant educational video link for that topic in that language.
Example format: {{"hi": "https://youtube.com/watch?v=...", "ta": "https://youtube.com/watch?v=..."}}
Return ONLY the JSON, no explanation."""

    try:
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 300}
        }
        reply = await call_gemini_with_fallback(payload)
        m = re.search(r'\{.*\}', reply, re.DOTALL)
        if m:
            links = json.loads(m.group())
            for l in other_langs:
                result[l] = links.get(l, source_link)
        else:
            for l in other_langs:
                result[l] = source_link
    except Exception as e:
        logger.error(f"YouTube link generation failed: {e}")
        for l in other_langs:
            result[l] = source_link

    return result


@router.post("/courses")
async def create_course(req: MultilingualCourseCreate, user=Depends(require_role("admin"))):
    db = get_db()

    valid_modes = ["online", "offline", "self-paced", "classroom"]
    if req.training_mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid training_mode. Must be one of {valid_modes}")

    # Determine which language has content (source language)
    source_lang = "en"
    title_val = ""
    desc_val = ""
    yt_val = ""

    if isinstance(req.title, dict):
        for lang in ALL_LANGS:
            if req.title.get(lang, "").strip():
                source_lang = lang
                title_val = req.title[lang].strip()
                break
    else:
        title_val = str(req.title)

    if isinstance(req.description, dict):
        desc_val = req.description.get(source_lang, "").strip()
        if not desc_val:
            for lang in ALL_LANGS:
                if req.description.get(lang, "").strip():
                    desc_val = req.description[lang].strip()
                    break
    else:
        desc_val = str(req.description)

    if isinstance(req.youtube_link, dict):
        yt_val = req.youtube_link.get(source_lang, "").strip()
        if not yt_val:
            for lang in ALL_LANGS:
                if req.youtube_link.get(lang, "").strip():
                    yt_val = req.youtube_link[lang].strip()
                    break
    else:
        yt_val = str(req.youtube_link)

    # Auto-translate title and description to all languages
    title_ml = await _translate_to_all_langs(title_val, source_lang) if title_val else {"en": "", "hi": "", "ta": ""}
    desc_ml = await _translate_to_all_langs(desc_val, source_lang) if desc_val else {"en": "", "hi": "", "ta": ""}

    # Auto-generate YouTube links for other languages
    yt_ml = await _generate_youtube_links_for_langs(title_val, source_lang, yt_val) if yt_val else {"en": "", "hi": "", "ta": ""}

    course_doc = {
        "title": title_ml,
        "description": desc_ml,
        "youtube_link": yt_ml,
        "training_mode": req.training_mode,
        "category": req.category,
        "type": "mandatory",
        "skills": getattr(req, 'skills', []) or [],
        "duration_minutes": getattr(req, 'duration_minutes', 0) or 0,
        "duration_days": 0,
        "linked_scheme": None,
        "incentive_value": 0,
    }
    result = await db.courses.insert_one(course_doc)
    return {"message": "Course created successfully", "course_id": str(result.inserted_id)}


@router.put("/courses/{course_id}")
async def update_course(course_id: str, req: CourseUpdateRequest, user=Depends(require_role("admin"))):
    """Update a course with single-language input. Auto-translates to other languages."""
    db = get_db()

    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    source_lang = req.source_lang if req.source_lang in ALL_LANGS else "en"

    # Translate title and description to all languages
    title_ml = await _translate_to_all_langs(req.title, source_lang) if req.title else course.get("title", {})
    desc_ml = await _translate_to_all_langs(req.description, source_lang) if req.description else course.get("description", {})

    # Generate YouTube links for other languages
    yt_ml = await _generate_youtube_links_for_langs(req.title, source_lang, req.youtube_link) if req.youtube_link else course.get("youtube_link", {})

    # Translate skills to all languages
    skills_en = req.skills or []
    skills_to_store = skills_en  # Store in English/source, will be translated at read time

    update_doc = {
        "title": title_ml,
        "description": desc_ml,
        "youtube_link": yt_ml,
        "skills": skills_to_store,
        "duration_minutes": req.duration_minutes,
        "training_mode": req.training_mode,
        "category": req.category,
    }

    await db.courses.update_one({"_id": ObjectId(course_id)}, {"$set": update_doc})

    return {"message": "Course updated successfully", "course_id": course_id}


@router.post("/courses/generate-ai")
async def generate_course_ai(req: AIGenerateRequest, user=Depends(require_role("admin"))):
    """Use AI to generate skills, YouTube link, and duration for a course."""
    lang_names = {"en": "English", "hi": "Hindi", "ta": "Tamil"}
    lang_name = lang_names.get(req.source_lang, "English")

    prompt = f"""For a manufacturing/industrial training course:
Title: "{req.title}"
{f'Description: "{req.description}"' if req.description else ''}
Language: {lang_name}

Generate:
1. A list of 4-6 specific skills employees will acquire (in {lang_name})
2. A relevant YouTube tutorial/training video URL for this topic (in {lang_name}). Provide a real, plausible YouTube URL.
3. Estimated duration in minutes (realistic for an industrial training video, typically 15-120 minutes)

Return ONLY a JSON object in this exact format:
{{"skills": ["skill1", "skill2", ...], "youtube_link": "https://youtube.com/watch?v=...", "duration_minutes": 30}}
Return ONLY the JSON, no explanation."""

    try:
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400}
        }
        reply = await call_gemini_with_fallback(payload)
        m = re.search(r'\{.*\}', reply, re.DOTALL)
        if m:
            data = json.loads(m.group())
            return {
                "skills": data.get("skills", [])[:6],
                "youtube_link": data.get("youtube_link", ""),
                "duration_minutes": data.get("duration_minutes", 30),
            }
        return {"skills": [], "youtube_link": "", "duration_minutes": 30}
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        return {"skills": [], "youtube_link": "", "duration_minutes": 30}


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
            "skills_raw": c.get("skills", []),
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

