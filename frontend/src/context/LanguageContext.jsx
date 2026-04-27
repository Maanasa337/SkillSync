import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import ta from '../locales/ta.json';

const staticTranslations = { en, hi, ta };

const LANG_LABELS = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
};

const LanguageContext = createContext(null);

export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [language, setLanguageState] = useState(() => {
    // Always default to English first for consistency
    return 'en';
  });

  // Dynamic translations (not used - keeping for compatibility)
  const [dynamicTranslations] = useState({});
  const [isTranslating] = useState(false);

  /**
   * Translate all static UI strings for a given language via Bhashini API.
   * DISABLED: Using static JSON translations only (hi.json, ta.json)
   */
  const fetchTranslationsForLang = useCallback(async (lang) => {
    // Skip Bhashini translation - use static locale files
    return;
  }, []);

  /**
   * Resolve a translation key.
   * Priority: static JSON > dynamicTranslations (Bhashini) > English fallback
   */
  const t = useCallback((key) => {
    // For English, always use static
    if (language === 'en') {
      const keys = key.split('.');
      let value = staticTranslations.en;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key;
        }
      }
      return value || key;
    }

    // 1. Try static JSON translations first
    const keys = key.split('.');
    let value = staticTranslations[language];
    let foundInStatic = false;
    
    if (value) {
      foundInStatic = true;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          foundInStatic = false;
          break;
        }
      }
    }
    
    if (foundInStatic && value) {
        return value;
    }

    // 2. If not found in static, check dynamic (Bhashini) translations
    const dynamicLang = dynamicTranslations[language];
    if (dynamicLang && dynamicLang[key]) {
      return dynamicLang[key];
    }

    // 3. Ultimate fallback: English
    let enFallback = staticTranslations.en;
    for (const k of keys) {
      if (enFallback && typeof enFallback === 'object' && k in enFallback) {
          enFallback = enFallback[k];
      } else {
          return key;
      }
    }
    return enFallback || key;
  }, [language, dynamicTranslations]);

  const setLanguage = useCallback((lang) => {
    if (staticTranslations[lang] || lang === 'en') {
      setLanguageState(lang);
      localStorage.setItem('skillsync_lang', lang);
      // Trigger Bhashini translation fetch for non-English
      if (lang !== 'en') {
        fetchTranslationsForLang(lang);
      }
    }
  }, [fetchTranslationsForLang]);

  // On mount, if user is logged in and has a primary_language, apply it
  useEffect(() => {
    const primary = localStorage.getItem('primary_language');
    if (primary && staticTranslations[primary]) {
      setLanguageState(primary);
      localStorage.setItem('skillsync_lang', primary);
      if (primary !== 'en') {
        fetchTranslationsForLang(primary);
      }
    } else {
      // If no primary language set, check for stored preference
      const stored = localStorage.getItem('skillsync_lang');
      if (stored && staticTranslations[stored] && stored !== 'en') {
        setLanguageState(stored);
        fetchTranslationsForLang(stored);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.primary_language && staticTranslations[user.primary_language]) {
      setLanguageState(user.primary_language);
      localStorage.setItem('skillsync_lang', user.primary_language);
      return;
    }

    if (location.pathname === '/login' || location.pathname === '/register') {
      setLanguageState('en');
    }
  }, [user?.primary_language, location.pathname]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, LANG_LABELS, isTranslating }}>
      {children}
    </LanguageContext.Provider>
  );
}
