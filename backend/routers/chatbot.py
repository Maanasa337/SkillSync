from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
import httpx
import logging
import asyncio
import os
from datetime import datetime, timedelta
from bson import ObjectId

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCE_Ay7fLk4g-zrVm4TCiXVgsMv9O3xvFE")

# Model fallback chain: lite models only to keep AI calls small and responsive.
GEMINI_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.0-flash-lite",
]

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
}

LOCALIZED_FALLBACKS = {
    "rate_limited": {
        "en": "You're sending messages too quickly. Please wait a moment.",
        "hi": "आप बहुत तेजी से संदेश भेज रहे हैं। कृपया थोड़ा इंतजार करें।",
        "ta": "நீங்கள் மிக வேகமாக செய்திகளை அனுப்புகிறீர்கள். தயவுசெய்து சிறிது நேரம் காத்திருக்கவும்.",
    },
    "busy": {
        "en": "I'm currently handling many requests. Please try again in a moment.",
        "hi": "मैं अभी कई अनुरोध संभाल रहा हूं। कृपया थोड़ी देर बाद फिर कोशिश करें।",
        "ta": "நான் இப்போது பல கோரிக்கைகளை கையாளுகிறேன். தயவுசெய்து சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.",
    },
    "connection": {
        "en": "I'm having trouble connecting right now. Please try again in a moment.",
        "hi": "मुझे अभी कनेक्ट करने में समस्या हो रही है। कृपया थोड़ी देर बाद फिर कोशिश करें।",
        "ta": "இப்போது இணைப்பதில் சிக்கல் உள்ளது. தயவுசெய்து சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.",
    },
}

# Rate limit: max requests per user per minute
RATE_LIMIT_MAX = 10
RATE_LIMIT_WINDOW_SECONDS = 60


class ChatbotRequest(BaseModel):
    message: str
    conversation_id: str
    lang: str


def normalize_lang(lang: str) -> str:
    return lang if lang in SUPPORTED_LANGUAGES else "en"


def fallback_message(kind: str, lang: str) -> str:
    lang = normalize_lang(lang)
    return LOCALIZED_FALLBACKS.get(kind, LOCALIZED_FALLBACKS["connection"]).get(lang)


def extract_title(title_field, lang: str) -> str:
    if isinstance(title_field, dict):
        return title_field.get(lang, title_field.get("en", "Unknown Course"))
    return str(title_field) if title_field else "Unknown Course"


async def check_rate_limit(db, user_id: str) -> bool:
    """
    Check and enforce per-user rate limiting.
    Returns True if allowed, raises HTTPException if limit exceeded.
    Stores timestamps in chatbot_rate_limits collection.
    """
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=RATE_LIMIT_WINDOW_SECONDS)

    # Find or create rate limit doc
    doc = await db.chatbot_rate_limits.find_one({"user_id": user_id})

    if doc:
        # Clean up old timestamps
        valid_timestamps = [ts for ts in doc.get("timestamps", []) if ts > cutoff]

        if len(valid_timestamps) >= RATE_LIMIT_MAX:
            return False

        # Add current timestamp
        valid_timestamps.append(now)
        await db.chatbot_rate_limits.update_one(
            {"user_id": user_id},
            {"$set": {"timestamps": valid_timestamps, "updated_at": now}},
        )
    else:
        await db.chatbot_rate_limits.insert_one(
            {"user_id": user_id, "timestamps": [now], "updated_at": now}
        )

    return True


def build_context_limited(courses_agg, incentives_list, user, lang):
    """
    Build context string with strict limits:
    - Max 5 assigned courses (most recent by deadline)
    - Max 3 assessment scores
    - Course descriptions truncated to 100 chars
    - Total context ≤ 800 chars
    """
    context_parts = []

    # User info
    exp_months = 0
    doj_str = user.get("date_of_joining")
    if doj_str:
        try:
            doj = datetime.fromisoformat(str(doj_str).replace("Z", ""))
            exp_months = (datetime.utcnow() - doj).days // 30
        except Exception:
            pass

    context_parts.append(
        f"Employee: {user.get('name')}, Dept: {user.get('department')}, Exp: {exp_months}mo"
    )

    # Courses — limit to 5, sort by deadline (most recent first)
    sorted_courses = sorted(
        courses_agg,
        key=lambda c: c.get("deadline", "") or "",
        reverse=True,
    )[:5]

    score_count = 0
    for ac in sorted_courses:
        title = extract_title(ac.get("title"), lang)
        status = ac.get("status", "not_started")
        completion = 100 if status == "completed" else (50 if status == "in_progress" else 0)
        score = ac.get("score", 0)

        line = f"- {title[:100]}: {completion}% done"
        if score and score_count < 3:
            line += f", score {score}"
            score_count += 1
        context_parts.append(line)

    # Incentives
    if incentives_list:
        context_parts.append(f"Schemes: {', '.join(incentives_list[:3])}")

    # Join and truncate to 800 chars
    context = "\n".join(context_parts)
    if len(context) > 800:
        context = context[:797] + "..."

    return context


def parse_followups(reply_text: str):
    """
    Parse FOLLOWUPS line from Gemini reply.
    Returns (clean_reply, [followup1, followup2])
    """
    lines = reply_text.strip().split("\n")
    followups = []
    clean_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.upper().startswith("FOLLOWUPS:"):
            parts = stripped[len("FOLLOWUPS:"):].strip().split("|")
            followups = [p.strip() for p in parts if p.strip()][:2]
        else:
            clean_lines.append(line)

    clean_reply = "\n".join(clean_lines).strip()
    return clean_reply, followups


async def find_course_links(db, reply_text: str):
    """
    Scan reply text for course titles present in MongoDB.
    Returns list of {title, course_id} for matches found.
    """
    try:
        all_courses = await db.courses.find({}).to_list(100)
        course_links = []

        for c in all_courses:
            title_field = c.get("title", "")
            # Check all language variants
            titles_to_check = []
            if isinstance(title_field, dict):
                titles_to_check = [v for v in title_field.values() if v]
            elif title_field:
                titles_to_check = [str(title_field)]

            for t in titles_to_check:
                if t and len(t) > 3 and t.lower() in reply_text.lower():
                    course_links.append({
                        "title": t,
                        "course_id": str(c["_id"]),
                    })
                    break  # One match per course is enough

        return course_links[:5]  # Max 5 links
    except Exception as e:
        logger.error(f"Course link scan error: {e}")
        return []


async def call_gemini_with_fallback(payload: dict) -> str:
    """
    Call Gemini API with model fallback chain.
    Primary and fallback models are Gemini lite variants.
    Raises Exception if all models fail.
    """
    last_error = None

    for i, model in enumerate(GEMINI_MODELS):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=payload)

                if resp.status_code == 429 or resp.status_code >= 400:
                    logger.warning(f"Gemini {model} returned {resp.status_code}: {resp.text[:300]}")
                    last_error = Exception(f"{model} returned {resp.status_code}")
                    if i < len(GEMINI_MODELS) - 1:
                        await asyncio.sleep(2)
                        continue
                    else:
                        raise last_error

                resp.raise_for_status()
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"]

        except Exception as e:
            logger.error(f"Gemini {model} error: {e}")
            last_error = e
            if i < len(GEMINI_MODELS) - 1:
                await asyncio.sleep(2)
                continue

    raise last_error or Exception("All Gemini models failed")


@router.post("/message")
async def chat_message(request: ChatbotRequest, user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        request.lang = normalize_lang(request.lang)
        response_language = SUPPORTED_LANGUAGES[request.lang]

        # RATE LIMITING
        allowed = await check_rate_limit(db, str(user["_id"]))
        if not allowed:
            rate_msg = fallback_message("rate_limited", request.lang)
            return {"reply": rate_msg, "conversation_id": request.conversation_id, "rate_limited": True}

        # STEP 1: Build context from MongoDB (with limits)
        context_string = ""
        try:
            if user["role"] == "employee":
                # Assigned courses via aggregation
                assigned_courses_agg = await db.progress.aggregate([
                    {"$match": {"user_id": str(user["_id"])}},
                    {"$addFields": {"course_id_obj": {"$toObjectId": "$course_id"}}},
                    {"$lookup": {
                        "from": "courses",
                        "localField": "course_id_obj",
                        "foreignField": "_id",
                        "as": "course_docs"
                    }},
                    {"$unwind": {"path": "$course_docs", "preserveNullAndEmptyArrays": True}},
                    {"$project": {
                        "title": "$course_docs.title",
                        "status": 1,
                        "score": 1,
                        "deadline": "$deadline_date"
                    }}
                ]).to_list(length=None)

                # Incentives
                incentives_cursor = db.incentives.find({"assigned_employee_ids": ObjectId(user["_id"])})
                incentives = []
                async for inc in incentives_cursor:
                    incentives.append(inc.get("scheme_name", "Unknown Scheme"))

                context_string = build_context_limited(
                    assigned_courses_agg, incentives, user, request.lang
                )

            elif user["role"] == "admin":
                total_emp = await db.users.count_documents({"role": "employee"})
                context_string = f"Admin: {user.get('name')}\nTotal Employees: {total_emp}"
                # Keep admin context minimal to save tokens
                if len(context_string) > 800:
                    context_string = context_string[:797] + "..."

        except Exception as e:
            logger.error(f"Context build error: {e}")
            pass

        # STEP 3: Fetch history & Call Gemini
        convo = await db.chatbot_conversations.find_one({"conversation_id": request.conversation_id})
        history = []
        if convo and "messages" in convo:
            history = convo["messages"][-6:]  # last 6

        gemini_contents = []
        for msg in history:
            gemini_contents.append({
                "role": msg["role"],
                "parts": [{"text": msg["content"]}]
            })
        gemini_contents.append({
            "role": "user",
            "parts": [{"text": request.message}]
        })

        system_prompt = f"""
You are SkillSync Assistant, a helpful training management chatbot for an enterprise learning platform called SkillSync.

Your role:
- Answer questions about the user's courses, assessments, deadlines, scores, and training progress
- Guide employees on how to complete courses and improve scores
- Explain NAPS, NEEM, and PMKVY incentive schemes when asked
- Give general learning and career guidance relevant to their department

Rules:
- Only answer questions related to training, courses, assessments, performance, incentives, and the SkillSync platform
- If asked anything outside this scope, reply exactly: "I'm here to help with your training journey on SkillSync. Is there anything about your courses or progress I can help with?"
- Never fabricate course data — use only what is in the context below
- Never reveal raw database IDs, ObjectIds, or internal field names
- Keep all responses under 150 words unless a step-by-step explanation is genuinely needed
- Understand user questions in English, Hindi, or Tamil
- Always respond only in {response_language}

After your reply, on a new line write exactly:
FOLLOWUPS: question1 | question2
These are 2 short follow-up questions the user might want to ask next. Keep them under 10 words each.
Write the main reply and follow-up questions only in {response_language}. Understand incoming user questions in English, Hindi, or Tamil.

User context:
{context_string}
"""

        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 300
            }
        }

        # Call Gemini with fallback chain
        gemini_reply = ""
        try:
            gemini_reply = await call_gemini_with_fallback(payload)
        except Exception as e:
            logger.error(f"All Gemini models failed: {e}")
            fallback_msg = fallback_message("busy", request.lang)
            return {"reply": fallback_msg, "conversation_id": request.conversation_id}

        # Parse followups from reply
        clean_reply, followups = parse_followups(gemini_reply)

        # Scan for course links
        course_links = await find_course_links(db, clean_reply)

        # STEP 4: Gemini already replies in the user's selected language.
        final_reply = clean_reply
        translated_followups = followups

        # STEP 5: Persist
        new_messages = [
            {"role": "user", "content": request.message, "timestamp": datetime.utcnow()},
            {"role": "model", "content": final_reply, "timestamp": datetime.utcnow()}
        ]

        if convo:
            updated_messages = convo.get("messages", []) + new_messages
            if len(updated_messages) > 20:
                updated_messages = updated_messages[-20:]

            await db.chatbot_conversations.update_one(
                {"conversation_id": request.conversation_id},
                {"$set": {"messages": updated_messages, "updated_at": datetime.utcnow()}}
            )
        else:
            await db.chatbot_conversations.insert_one({
                "conversation_id": request.conversation_id,
                "user_id": ObjectId(user["_id"]),
                "messages": new_messages,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })

        return {
            "reply": final_reply,
            "conversation_id": request.conversation_id,
            "suggested_followups": translated_followups,
            "course_links": course_links,
        }

    except Exception as e:
        logger.error(f"Unhandled chatbot error: {e}")
        fallback = fallback_message("connection", getattr(request, "lang", "en"))
        return {"reply": fallback, "conversation_id": request.conversation_id}
