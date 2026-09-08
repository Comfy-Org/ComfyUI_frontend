/**
 * How much of a built page a reader actually gets in their own language.
 *
 * Coverage used to be reported per key namespace, which was a proxy for a page
 * and stopped being one: the median page reaches 14 namespaces, not its own, so
 * "pricing 100%" said nothing about whether `/ja/pricing` was ready. Measuring
 * the built pages instead needs no key mapping at all, which also means it sees
 * copy that arrives through data files and content collections — the copy a
 * static scan of `t()` calls cannot follow.
 *
 * Pure and DOM-free so it can be unit-tested directly and reused by both the
 * coverage report and the CI check.
 */

interface PageComparison {
  english: string
  localized: string
  preserveTerms: readonly string[]
}

export interface PageCoverage {
  /** Fraction of translatable strings that differ from English, 0 to 1. */
  translated: number
  /** Localized tag count over English's. Below 1 means content is missing. */
  tagRatio: number
  /** How many strings were considered. */
  total: number
  /** A sample of what is still English, for the report to show. */
  stillEnglish: string[]
}

function stripped(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

/**
 * Opening tag names in document order.
 *
 * The hreflang cluster is dropped because only one side carries it: a page held
 * back in its own locale emits no alternates, so English has four tags it does
 * not, on every held-back page.
 */
export function contentTags(html: string): string[] {
  const body = stripped(html)
    .replace(/<link\b[^>]*\brel="alternate"[^>]*>/g, '')
    .replace(/<meta\b[^>]*\bproperty="og:locale:alternate"[^>]*>/g, '')
  return [...body.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)].map((match) =>
    match[1].toLowerCase()
  )
}

function decode(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Visible text nodes, in document order, with entities decoded. */
export function visibleText(html: string): string[] {
  return stripped(html)
    .split(/<[^>]+>/)
    .map((part) => decode(part).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/**
 * Whether a translator would have been expected to change this string.
 *
 * A brand name, a URL or a bare number is identical in every language, so
 * counting it as untranslated would cap a finished page below 100% and make the
 * number useless for deciding whether to publish.
 */
function isTranslatable(text: string, preserved: ReadonlySet<string>): boolean {
  if (text.length < 2) return false
  if (!/\p{Letter}/u.test(text)) return false
  if (/^https?:\/\//.test(text)) return false
  // A formatted count is the same in every language, and one of them — the live
  // GitHub star count in the header — is on every page of the site, so leaving
  // it in put the same false miss under every score.
  if (/^[\d.,]+\s*[KMB]?$/.test(text)) return false
  return !preserved.has(text.toLowerCase())
}

export function comparePage({
  english,
  localized,
  preserveTerms
}: PageComparison): PageCoverage {
  const englishTags = contentTags(english)
  const tagRatio =
    englishTags.length === 0
      ? 1
      : Math.min(1, contentTags(localized).length / englishTags.length)

  const preserved = new Set(preserveTerms.map((term) => term.toLowerCase()))
  const source = visibleText(english)
  const target = visibleText(localized)

  // Compared as a multiset, never by position. Equal node counts do not imply
  // equal order: markup reordering inside a translated string moves an
  // unchanged English node to a different index, where a positional check
  // compares it against an unrelated node and scores it as translated. Counting
  // occurrences and consuming each match is order-independent and still refuses
  // to credit the same localized node twice.
  const remaining = new Map<string, number>()
  for (const text of target) {
    remaining.set(text, (remaining.get(text) ?? 0) + 1)
  }

  let total = 0
  let untranslated = 0
  const stillEnglish: string[] = []
  for (const text of source) {
    if (!isTranslatable(text, preserved)) continue
    total++
    const left = remaining.get(text) ?? 0
    if (left === 0) continue
    remaining.set(text, left - 1)
    untranslated++
    if (stillEnglish.length < 8) stillEnglish.push(text)
  }

  return {
    translated: total === 0 ? 1 : (total - untranslated) / total,
    tagRatio,
    total,
    stillEnglish
  }
}
