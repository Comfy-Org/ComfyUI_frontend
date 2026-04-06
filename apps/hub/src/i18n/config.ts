// Supported locales with metadata
export const LANGUAGES = {
  en: { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  zh: {
    code: 'zh',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    dir: 'ltr'
  },
  'zh-TW': {
    code: 'zh-TW',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    dir: 'ltr'
  },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr' },
  tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr' },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  'pt-BR': {
    code: 'pt-BR',
    name: 'Portuguese (Brazil)',
    nativeName: 'Português',
    dir: 'ltr'
  }
} as const

export const DEFAULT_LOCALE = 'en'
export const LOCALES = Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]

// Map locale to index file name
export const LOCALE_INDEX_FILES: Record<string, string> = {
  en: 'index.json',
  zh: 'index.zh.json',
  'zh-TW': 'index.zh-TW.json',
  ja: 'index.ja.json',
  ko: 'index.ko.json',
  es: 'index.es.json',
  fr: 'index.fr.json',
  ru: 'index.ru.json',
  tr: 'index.tr.json',
  ar: 'index.ar.json',
  'pt-BR': 'index.pt-BR.json'
}

export type Locale = keyof typeof LANGUAGES
