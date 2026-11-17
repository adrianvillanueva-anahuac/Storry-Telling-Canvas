import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLocale, Language, translate, TranslationKey } from './translations';

const STORAGE_KEY = 'vwc-language';

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  locale: 'en-US' | 'es-ES';
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tRole: (role: string | undefined | null) => string;
  tColumn: (column: string | undefined | null) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function detectInitialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') {
      return saved;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  }
  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage access errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'en' ? 'es' : 'en'));
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );

  const tRole = useCallback(
    (role: string | undefined | null) => {
      if (role === 'Admin') return translate(language, 'role.Admin');
      if (role === 'Editor') return translate(language, 'role.Editor');
      if (role === 'Viewer') return translate(language, 'role.Viewer');
      return role || '';
    },
    [language],
  );

  const tColumn = useCallback(
    (column: string | undefined | null) => {
      if (column === 'enfoque') return translate(language, 'column.enfoque');
      if (column === 'accion') return translate(language, 'column.accion');
      if (column === 'descripcion') return translate(language, 'column.descripcion');
      return column || '';
    },
    [language],
  );

  const locale = useMemo(() => getLocale(language), [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      locale,
      t,
      tRole,
      tColumn,
    }),
    [language, setLanguage, toggleLanguage, locale, t, tRole, tColumn],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
