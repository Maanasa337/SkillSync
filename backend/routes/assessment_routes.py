from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from models import AssessmentSubmitRequest
from auth import require_role
from database import get_db
from bson import ObjectId
from datetime import datetime
from utils.bhashini import translate
import asyncio

router = APIRouter(tags=["Assessment"])

@router.get("/assessments/{course_id}")
async def get_assessment(course_id: str, lang: Optional[str] = Query(default="en"), user=Depends(require_role("employee"))):
    db = get_db()
    
    # Check if course is assigned to user
    progress = await db.progress.find_one({
        "user_id": user["_id"],
        "course_id": course_id
    })
    if not progress:
        progress = await db.progress.find_one({
            "user_id": str(user["_id"]),
            "course_id": course_id
        })
    
    if not progress:
        raise HTTPException(status_code=403, detail="Course not assigned to you")
        
    assessment = await db.assessments.find_one({"course_id": course_id})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found for this course")
    source_lang = assessment.get("source_lang", "en")
        
    # Return questions without the correct answers
    safe_questions = []
    
    async def translate_q(q):
        try:
            t_q = await translate(q["question"], source_lang, lang) if lang != source_lang else q["question"]
            t_opts = await asyncio.gather(*(translate(o, source_lang, lang) for o in q["options"])) if lang != source_lang else q["options"]
            return {"question": t_q, "options": list(t_opts)}
        except Exception:
            return {"question": q["question"], "options": q["options"]}

    if lang != source_lang:
        safe_questions = await asyncio.gather(*(translate_q(q) for q in assessment["questions"]))
        safe_questions = list(safe_questions)
    else:
        for q in assessment["questions"]:
            safe_questions.append({
                "question": q["question"],
                "options": q["options"]
            })
        
    return {"questions": safe_questions}

@router.post("/assessment/submit")
async def submit_assessment(req: AssessmentSubmitRequest, user=Depends(require_role("employee"))):
    db = get_db()
    user_id = user["_id"]

    progress = await db.progress.find_one({
        "user_id": user_id,
        "course_id": req.course_id,
    })
    if not progress:
        progress = await db.progress.find_one({
            "user_id": str(user_id),
            "course_id": req.course_id,
        })
    
    if not progress:
        raise HTTPException(status_code=404, detail="Course not assigned to you")

    if progress["status"] == "completed":
        raise HTTPException(status_code=400, detail="Course already completed")

    assessment = await db.assessments.find_one({"course_id": req.course_id})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    questions = assessment["questions"]
    if len(req.answers) != len(questions):
        raise HTTPException(status_code=400, detail=f"Expected {len(questions)} answers, got {len(req.answers)}")
        
    # Grade assessment
    correct_count = 0
    review_items = []
    for idx, q in enumerate(questions):
        selected_answer = req.answers[idx]
        correct_answer = q["correct_answer"]
        is_correct = selected_answer == correct_answer
        if is_correct:
            correct_count += 1
        review_items.append({
            "question_index": idx,
            "selected_answer": selected_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
        })
            
    score = (correct_count / len(questions)) * 100
    
    # Needs 60% to pass
    passed = score >= 60
    
    # If passed, mark course as completed
    if passed:
        await db.progress.update_one(
            {"_id": progress["_id"]},
            {"$set": {
                "status": "completed",
                "score": score,
                "assessment_answers": req.answers,
                "assessment_review": review_items,
                "completed_at": datetime.utcnow().isoformat(),
            }}
        )
    else:
        # Just update score and keep in progress
        await db.progress.update_one(
            {"_id": progress["_id"]},
            {"$set": {
                "status": "in_progress",
                "score": score,
                "assessment_answers": req.answers,
                "assessment_review": review_items,
            }}
        )

    return {
        "score": score,
        "passed": passed,
        "message": "Congratulations! You passed." if passed else "Please review the material and try again. Minimum 60% required to pass."
    }


@router.get("/assessments/{course_id}/review")
async def get_assessment_review(course_id: str, lang: Optional[str] = Query(default="en"), user=Depends(require_role("employee"))):
    db = get_db()
    progress = await db.progress.find_one({
        "user_id": user["_id"],
        "course_id": course_id,
        "status": "completed",
    })
    if not progress:
        progress = await db.progress.find_one({
            "user_id": str(user["_id"]),
            "course_id": course_id,
            "status": "completed",
        })
    if not progress:
        raise HTTPException(status_code=404, detail="Completed assessment not found")

    assessment = await db.assessments.find_one({"course_id": course_id})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    source_lang = assessment.get("source_lang", "en")

    course = None
    try:
        course = await db.courses.find_one({"_id": ObjectId(course_id)})
    except Exception:
        course = None

    def resolve_ml(field):
        if isinstance(field, dict):
            return field.get(lang) or field.get("en") or next((v for v in field.values() if v), "")
        return field or ""

    submitted_answers = progress.get("assessment_answers", [])
    questions = assessment.get("questions", [])
    review = []

    async def translate_text(text):
        if lang == source_lang:
            return text
        try:
            return await translate(text, source_lang, lang)
        except Exception:
            return text

    for idx, q in enumerate(questions):
        options = q.get("options", [])
        if lang != source_lang:
            translated_options = await asyncio.gather(*(translate_text(o) for o in options))
            options = list(translated_options)

        correct_answer = q.get("correct_answer")
        selected_answer = submitted_answers[idx] if idx < len(submitted_answers) else None
        review.append({
            "question_index": idx,
            "question": await translate_text(q.get("question", "")),
            "options": options,
            "selected_answer": selected_answer,
            "selected_text": options[selected_answer] if isinstance(selected_answer, int) and 0 <= selected_answer < len(options) else None,
            "correct_answer": correct_answer,
            "correct_text": options[correct_answer] if isinstance(correct_answer, int) and 0 <= correct_answer < len(options) else None,
            "is_correct": selected_answer == correct_answer,
        })

    return {
        "course_id": course_id,
        "course_title": resolve_ml(course.get("title", "")) if course else "",
        "score": progress.get("score", 0),
        "completed_at": progress.get("completed_at"),
        "questions": review,
    }
