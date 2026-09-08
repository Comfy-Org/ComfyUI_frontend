/**
 * The deterministic quality gate for machine translations.
 *
 * We own quality, not the model. Everything checkable without judgement is
 * checked here and fails CI; everything needing judgement goes to the AI
 * reviewer. Ported from the hub's `validate-translations.ts`, with the checks
 * retargeted at marketing copy: single-brace placeholders and line structure
 * matter here, where the hub cared about array lengths and FAQ shapes.
 *
 * This validates what EXISTS. It never complains that a key is missing, because
 * absence is normal between runs and is handled by the indexing predicate: an
 * untranslated page de-indexes rather than blocking anyone.
 */
import { localizeHref } from '../../config/routes'
import type { Locale } from '../../config/locales'
import type { EnglishSource, TranslationLayer } from './types'

export interface Violation {
  key: string
  locale: string
  kind:
    | 'placeholder'
    | 'url'
    | 'glossary'
    | 'structure'
    | 'script'
    | 'brand-voice'
    | 'unknown-key'
  detail: string
}

/** Scripts a translation must actually contain. Latin-script locales rely on the
 * English-leakage signal instead, which the script check below approximates by
 * requiring the target script to appear at all. */
const SCRIPT_RANGES: Partial<Record<Locale, RegExp>> = {
  'zh-CN': /[一-鿿]/,
  ja: /[぀-ヿ一-鿿]/
}

/** English hype the brand voice bans. Introducing it is a translation defect
 * even when the meaning survives, because the English never claimed it. */
const BANNED_HYPE = [
  'stunning',
  'powerful',
  'seamless',
  'effortless',
  'unlock',
  'revolutionary',
  'game-changing',
  'cutting-edge',
  'unleash'
]

const PLACEHOLDER = /\{[a-zA-Z0-9_]+\}/g
// The final character may not be sentence punctuation. Stopping only at
// whitespace swallowed the full stop in `Read more at https://comfy.org/mcp.`
// and then demanded the translation contain it, which no Japanese sentence
// would. Two correct translations were dropped to English by that, silently.
const URL = /https?:\/\/[^\s)»"'<]*[^\s)»"'<.,;:!?]/g

function matches(value: string, pattern: RegExp): string[] {
  return [...value.matchAll(pattern)].map((m) => m[0]).sort()
}

/**
 * Whether a preserve term appears as a WORD, not merely as a substring.
 *
 * `Wan` is a video model and also the first three letters of `Want`, so a
 * substring test demanded that the Japanese for "Want to build tools" contain
 * "Wan". That is impossible, so the key could never pass: a permanent CI
 * failure on 51 strings. Brand names are words, and the check has to say so.
 *
 * Boundaries are only applied at ends that are word characters, so terms like
 * `Wan 3.0` and `SOC 2` still match correctly.
 */
const MARKDOWN_LINK = /\]\(([^)\s]+)/g

/**
 * Every target a markdown link points at.
 *
 * Shared by the translator, which asks the model to leave these alone, and by
 * the FAQ verifier, which refuses a translation that changed one. A relative
 * target is already correct for every locale — `localizeHref` leaves an
 * unpublished route unprefixed — so the right behaviour is always to copy it
 * across untouched.
 */
export function linkTargets(markdown: string): string[] {
  return [...markdown.matchAll(MARKDOWN_LINK)].map((match) => match[1])
}

/**
 * Point every internal markdown link where the locale actually serves.
 *
 * The Chinese files localize theirs by hand, so leaving a Japanese link
 * unprefixed would be inconsistent with them — and prefixing it blindly would
 * point at a page Japanese does not publish. `localizeHref` answers both,
 * because it already refuses to prefix a route the locale does not serve.
 *
 * Applied by the writer rather than asked of the model: the model is told to
 * leave link targets alone, and the correct target is then computed here, where
 * it cannot be got wrong.
 */
export function localizeMarkdownLinks(
  markdown: string,
  locale: Locale
): string {
  return markdown.replace(
    /\]\((\/[^)\s]*)\)/g,
    (_match, href: string) => `](${localizeHref(href, locale)})`
  )
}

export function containsTerm(value: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const prefix = /^\w/.test(term) ? '\\b' : ''
  const suffix = /\w$/.test(term) ? '\\b' : ''
  return new RegExp(`${prefix}${escaped}${suffix}`).test(value)
}

/**
 * Whether the English has enough translatable prose to demand target script.
 *
 * A string made only of proper nouns, placeholders, URLs and punctuation has
 * nothing to translate, so requiring Japanese characters would fail it on every
 * run forever. Strip everything that must stay verbatim and judge what is left.
 */
function hasTranslatableProse(
  english: string,
  preserveTerms: readonly string[]
): boolean {
  let rest = english
  for (const term of preserveTerms) {
    if (containsTerm(rest, term)) rest = rest.split(term).join(' ')
  }
  rest = rest
    .replace(PLACEHOLDER, ' ')
    .replace(URL, ' ')
    .replace(/[^a-zA-Z ]/g, ' ')
  return rest.replace(/\s+/g, '').length >= 12
}

export function collectViolations(
  english: EnglishSource,
  translated: TranslationLayer,
  locale: Locale,
  preserveTerms: readonly string[]
): Violation[] {
  const violations: Violation[] = []
  const add = (key: string, kind: Violation['kind'], detail: string) => {
    violations.push({ key, locale, kind, detail })
  }

  // A key the translation has and the English does not has no contract to be
  // checked against, so the loop below would never see it. The hub flags these
  // as stale or hallucinated; ours are pruned on the next source build, but
  // only after a cycle and without saying so.
  for (const key of Object.keys(translated)) {
    if (!(key in english)) {
      add(key, 'unknown-key', 'translated but absent from the English source')
    }
  }

  for (const [key, source] of Object.entries(english)) {
    // Asked of the object rather than of its type: a `Record` says every key is
    // present, which is exactly what the loop above disproves. Not yet
    // translated is not a defect — see the module comment.
    if (!Object.hasOwn(translated, key)) continue
    const value = translated[key]

    const sourceTokens = matches(source, PLACEHOLDER)
    const valueTokens = matches(value, PLACEHOLDER)
    if (sourceTokens.join('\0') !== valueTokens.join('\0')) {
      add(
        key,
        'placeholder',
        `expected ${sourceTokens.join(', ') || '(none)'}, got ${valueTokens.join(', ') || '(none)'}`
      )
    }

    for (const url of matches(source, URL)) {
      if (!value.includes(url)) add(key, 'url', `lost or altered ${url}`)
    }

    for (const term of preserveTerms) {
      if (containsTerm(source, term) && !containsTerm(value, term)) {
        add(key, 'glossary', `"${term}" was translated away`)
      }
    }

    const sourceLines = source.split('\n').length
    const valueLines = value.split('\n').length
    if (sourceLines !== valueLines) {
      add(
        key,
        'structure',
        `English has ${sourceLines} line(s), translation has ${valueLines}`
      )
    }

    const script = SCRIPT_RANGES[locale]
    if (
      script &&
      hasTranslatableProse(source, preserveTerms) &&
      !script.test(value)
    ) {
      add(key, 'script', 'no target-script characters, left in English')
    }

    const lowerSource = source.toLowerCase()
    const lowerValue = value.toLowerCase()
    for (const word of BANNED_HYPE) {
      if (lowerValue.includes(word) && !lowerSource.includes(word)) {
        add(key, 'brand-voice', `introduced "${word}", absent from the English`)
      }
    }
  }

  return violations
}
