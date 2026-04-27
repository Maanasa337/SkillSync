"""
Bhashini Translation Utility
Provides async translation via the Bhashini API with in-memory caching.
"""
import httpx
import logging

logger = logging.getLogger(__name__)

BHASHINI_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
BHASHINI_UDYATH_KEY = "53a0d9ed53-bb03-4004-b073-0e86b55c384a"
BHASHINI_API_KEY = "wyq26lZ_59P0QjUvXH0kd3_0sBvIYNZG59ZK6TEvcZ_mqCag2hkkOH0AvcqyLemW"

# In-memory cache keyed by "text:src:tgt"
_translation_cache: dict[str, str] = {}


async def translate(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translate text using Bhashini API.
    Returns original text if target == source or target == 'en'.
    Caches results in-memory for the server session.
    Falls back to original text on any error.
    """
    if not text or not text.strip():
        return text

    if target_lang == source_lang or target_lang == "en":
        return text

    cache_key = f"{text}:{source_lang}:{target_lang}"
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]

    try:
        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_lang,
                            "targetLanguage": target_lang,
                        }
                    },
                }
            ],
            "inputData": {"input": [{"source": text}]},
        }

        headers = {
            "Authorization": BHASHINI_API_KEY,
            "x-api-key": BHASHINI_API_KEY,
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(BHASHINI_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        translated = data["pipelineResponse"][0]["output"][0]["target"]
        _translation_cache[cache_key] = translated
        return translated

    except Exception as e:
        logger.error(f"Bhashini translation failed for '{text[:50]}...': {e}")
        return text  # Graceful fallback


async def translate_batch(texts: list[str], source_lang: str, target_lang: str) -> list[str]:
    """
    Translate a list of texts. Uses cache for already-translated strings.
    Groups uncached texts into a single API call where possible.
    """
    if target_lang == source_lang or target_lang == "en":
        return texts

    results = [""] * len(texts)
    uncached_indices = []
    uncached_texts = []

    for i, text in enumerate(texts):
        if not text or not text.strip():
            results[i] = text
            continue

        cache_key = f"{text}:{source_lang}:{target_lang}"
        if cache_key in _translation_cache:
            results[i] = _translation_cache[cache_key]
        else:
            uncached_indices.append(i)
            uncached_texts.append(text)

    if not uncached_texts:
        return results

    # Bhashini API supports single input at a time, so translate individually
    for idx, text in zip(uncached_indices, uncached_texts):
        translated = await translate(text, source_lang, target_lang)
        results[idx] = translated

    return results
