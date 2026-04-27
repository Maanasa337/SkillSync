"""
Course Materials Router — GridFS file upload, download, stream, delete
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, Response
from database import get_db
from auth import get_current_user, require_role
from bson import ObjectId
from datetime import datetime
import logging, re

router = APIRouter(prefix="/api/courses", tags=["Course Materials"])
logger = logging.getLogger(__name__)

ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".mp4": "video/mp4",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_FILES_PER_COURSE = 5


def get_ext(filename: str) -> str:
    idx = filename.rfind(".")
    return filename[idx:].lower() if idx != -1 else ""


def sanitize_filename(filename: str) -> str:
    return re.sub(r'[^\w\s\-.]', '', filename).strip()


async def get_bucket(db):
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket
    return AsyncIOMotorGridFSBucket(db, bucket_name="course_materials")


@router.post("/{course_id}/materials")
async def upload_material(
    course_id: str,
    file: UploadFile = File(...),
    language: str = Form(default="all"),
    user: dict = Depends(require_role("admin")),
):
    db = get_db()
    # Verify course exists
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Course not found")

    # Check max files
    existing = course.get("materials", [])
    if len(existing) >= MAX_FILES_PER_COURSE:
        raise HTTPException(400, f"Maximum {MAX_FILES_PER_COURSE} files per course")

    # Validate file type
    ext = get_ext(file.filename or "")
    if ext not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type {ext} not allowed. Allowed: {', '.join(ALLOWED_TYPES.keys())}")

    # Read file
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File exceeds 100MB limit")

    content_type = ALLOWED_TYPES.get(ext, file.content_type or "application/octet-stream")
    safe_name = sanitize_filename(file.filename or "file")

    # Store in GridFS
    bucket = await get_bucket(db)
    metadata = {
        "course_id": ObjectId(course_id),
        "uploaded_by": ObjectId(user["_id"]),
        "content_type": content_type,
        "file_size": len(content),
        "language": language,
        "uploaded_at": datetime.utcnow(),
    }
    file_id = await bucket.upload_from_stream(
        safe_name, content, metadata=metadata
    )

    # Append to course materials array
    mat_entry = {
        "file_id": str(file_id),
        "filename": safe_name,
        "content_type": content_type,
        "file_size": len(content),
        "language": language,
        "uploaded_at": datetime.utcnow().isoformat(),
    }
    await db.courses.update_one(
        {"_id": ObjectId(course_id)},
        {"$push": {"materials": mat_entry}}
    )

    updated = await db.courses.find_one({"_id": ObjectId(course_id)})
    materials = updated.get("materials", [])
    return {"message": "File uploaded", "materials": materials}


@router.get("/{course_id}/materials")
async def list_materials(course_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Course not found")

    # Employee: verify assigned
    if user["role"] == "employee":
        assigned = await db.progress.find_one({
            "user_id": str(user["_id"]), "course_id": course_id
        })
        if not assigned:
            raise HTTPException(403, "Not assigned to this course")

    materials = course.get("materials", [])

    # Filter by employee language
    if user["role"] == "employee":
        lang = user.get("primary_language", "en")
        materials = [m for m in materials if m.get("language") in (lang, "all")]

    return {"materials": materials}


@router.get("/materials/{file_id}")
async def stream_material(file_id: str, request: Request):
    db = get_db()
    try:
        fid = ObjectId(file_id)
    except Exception:
        raise HTTPException(400, "Invalid file ID")

    file_doc = await db["course_materials.files"].find_one({"_id": fid})
    if not file_doc:
        raise HTTPException(404, "File not found")

    bucket = await get_bucket(db)
    content_type = file_doc.get("metadata", {}).get("content_type", "application/octet-stream")
    filename = file_doc.get("filename", "file")
    file_size = file_doc.get("length", 0)

    # Handle Range requests for MP4 streaming
    range_header = request.headers.get("range")
    if range_header and "video" in content_type:
        range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else min(start + 1024*1024, file_size - 1)
            end = min(end, file_size - 1)
            length = end - start + 1

            grid_out = await bucket.open_download_stream(fid)
            await grid_out.seek(start)
            data = await grid_out.read(length)

            return Response(
                content=data,
                status_code=206,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(length),
                    "Content-Type": content_type,
                },
            )

    # Full file stream
    async def file_stream():
        grid_out = await bucket.open_download_stream(fid)
        while True:
            chunk = await grid_out.read(65536)
            if not chunk:
                break
            yield chunk

    headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "Content-Type": content_type,
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
    }
    return StreamingResponse(file_stream(), media_type=content_type, headers=headers)


@router.delete("/{course_id}/materials/{file_id}")
async def delete_material(course_id: str, file_id: str, user: dict = Depends(require_role("admin"))):
    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Course not found")

    # Delete from GridFS
    bucket = await get_bucket(db)
    try:
        await bucket.delete(ObjectId(file_id))
    except Exception as e:
        logger.error(f"GridFS delete error: {e}")

    # Remove from course materials array
    await db.courses.update_one(
        {"_id": ObjectId(course_id)},
        {"$pull": {"materials": {"file_id": file_id}}}
    )

    return {"message": "Material deleted"}
