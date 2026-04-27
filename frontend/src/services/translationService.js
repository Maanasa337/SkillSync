/**
 * Translation Service
 * Client-side caching layer for Bhashini API translations.
 */
import { translateTexts as apiTranslate } from '../api';

// Client-side cache: Map<langCode, Map<englishText, translatedText>>
const translationCache = new Map();

/**
 * Get cached translation or null
 */
function getCached(lang, text) {
  const langCache = translationCache.get(lang);
  if (langCache) {
    return langCache.get(text) || null;
  }
  return null;
}

/**
 * Store translation in cache
 */
function setCache(lang, text, translated) {
  if (!translationCache.has(lang)) {
    translationCache.set(lang, new Map());
  }
  translationCache.get(lang).set(text, translated);
}

/**
 * Translate an array of texts to the target language.
 * Uses client-side cache and batches uncached strings to the API.
 * Returns array of translated strings in same order.
 */
export async function translateBatch(texts, targetLang) {
  if (!texts || texts.length === 0) return [];
  if (targetLang === 'en') return [...texts];

  const results = new Array(texts.length);
  const uncachedIndices = [];
  const uncachedTexts = [];

  // Check cache first
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || !text.trim()) {
      results[i] = text;
      continue;
    }
    const cached = getCached(targetLang, text);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(text);
    }
  }

  // Fetch uncached translations from API
  if (uncachedTexts.length > 0) {
    try {
      const response = await apiTranslate(uncachedTexts, targetLang);
      const translations = response.data.translations;
      
      for (let j = 0; j < uncachedIndices.length; j++) {
        const idx = uncachedIndices[j];
        const translated = translations[j] || uncachedTexts[j];
        results[idx] = translated;
        setCache(targetLang, uncachedTexts[j], translated);
      }
    } catch (error) {
      console.error('Translation API failed, using English fallback:', error);
      // Fallback to English
      for (const idx of uncachedIndices) {
        results[idx] = texts[idx];
      }
    }
  }

  return results;
}

/**
 * Clear the translation cache for a specific language or all languages.
 */
export function clearCache(lang) {
  if (lang) {
    translationCache.delete(lang);
  } else {
    translationCache.clear();
  }
}
