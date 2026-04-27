from fastapi import APIRouter, Depends
from models import TranslateRequest
from auth import get_current_user
from utils.bhashini import translate_batch

router = APIRouter(tags=["Translation"])


@router.post("/api/translate")
async def translate_texts(req: TranslateRequest, user=Depends(get_current_user)):
    """
    Batch translate texts via Bhashini API.
    Body: { texts: [str], target_lang: str }
    Returns: { translations: [str] }
    """
    if not req.texts:
        return {"translations": []}

    if req.target_lang == "en":
        return {"translations": req.texts}

    translations = await translate_batch(
        texts=req.texts,
        source_lang="en",
        target_lang=req.target_lang,
    )

    return {"translations": translations}
