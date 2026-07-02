import type {
  BundledLanguage,
  BundledTheme,
  HighlighterGeneric,
  ThemedToken
} from 'shiki'
import { createHighlighter } from 'shiki'

export const isItalic = (fontStyle: number | undefined): boolean =>
  !!(fontStyle && fontStyle & 1)
export const isBold = (fontStyle: number | undefined): boolean =>
  !!(fontStyle && fontStyle & 2)
export const isUnderline = (fontStyle: number | undefined): boolean =>
  !!(fontStyle && fontStyle & 4)

export interface TokenizedCode {
  tokens: ThemedToken[][]
  fg: string
  bg: string
}

const THEME: BundledTheme = 'one-dark-pro'

const highlighterCache = new Map<
  string,
  Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>
>()
const tokensCache = new Map<string, TokenizedCode>()
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>()

function cacheKey(code: string, language: BundledLanguage): string {
  const start = code.slice(0, 100)
  const end = code.length > 100 ? code.slice(-100) : ''
  return `${language}:${code.length}:${start}:${end}`
}

function getHighlighter(
  language: BundledLanguage
): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> {
  const cached = highlighterCache.get(language)
  if (cached) return cached

  const promise = createHighlighter({ themes: [THEME], langs: [language] })
  highlighterCache.set(language, promise)
  return promise
}

export function createRawTokens(code: string): TokenizedCode {
  return {
    tokens: code
      .split('\n')
      .map((line) =>
        line === '' ? [] : [{ content: line, color: 'inherit' } as ThemedToken]
      ),
    fg: 'inherit',
    bg: 'transparent'
  }
}

export function highlightCode(
  code: string,
  language: BundledLanguage,
  callback?: (result: TokenizedCode) => void
): TokenizedCode | null {
  const key = cacheKey(code, language)
  const cached = tokensCache.get(key)
  if (cached) return cached

  if (callback) {
    if (!subscribers.has(key)) subscribers.set(key, new Set())
    subscribers.get(key)!.add(callback)
  }

  getHighlighter(language)
    .then((highlighter) => {
      const loadedLangs = highlighter.getLoadedLanguages()
      const lang = loadedLangs.includes(language) ? language : 'text'
      const result = highlighter.codeToTokens(code, { lang, theme: THEME })
      const tokenized: TokenizedCode = {
        tokens: result.tokens,
        fg: result.fg ?? 'inherit',
        bg: result.bg ?? 'transparent'
      }
      tokensCache.set(key, tokenized)
      subscribers.get(key)?.forEach((sub) => sub(tokenized))
      subscribers.delete(key)
    })
    .catch(() => subscribers.delete(key))

  return null
}
