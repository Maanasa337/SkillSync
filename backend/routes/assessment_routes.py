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
        raise HTTPException(status_code=403, detail="Course not assigned to you")
        
    assessment = await db.assessments.find_one({"course_id": course_id})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found for this course")
        
    # Return questions without the correct answers
    safe_questions = []
    
    async def translate_q(q):
        try:
            t_q = await translate(q["question"], "en", lang) if lang != "en" else q["question"]
            t_opts = await asyncio.gather(*(translate(o, "en", lang) for o in q["options"])) if lang != "en" else q["options"]
            return {"question": t_q, "options": list(t_opts)}
        except Exception:
            return {"question": q["question"], "options": q["options"]}

    if lang != "en":
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
    for idx, q in enumerate(questions):
        if req.answers[idx] == q["correct_answer"]:
            correct_count += 1
            
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
            }}
        )

    return {
        "score": score,
        "passed": passed,
        "message": "Congratulations! You passed." if passed else "Please review the material and try again. Minimum 60% required to pass."
    }
