import MiniSearch from 'minisearch'
import type { SearchResult } from 'minisearch'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

// MiniSearch serializes the index but not the search options, so the tokenizer
// and field list live here and are used at both index and query time.

const SEARCH_FIELDS = [
  'title',
  'description',
  'tags',
  'models',
  'name'
] as const

// Usage only reorders hits within this fraction of the top score, so popularity
// never overrides a clearly-better text match. 5% tuned empirically.
const USAGE_TIEBREAK_BAND = 0.05

// Script-matched so spaced neighbors like Korean fall to the word tokenizer.
const CJK = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}]/u
const CJK_RUN = new RegExp(`${CJK.source}+`, 'gu')

// Unigrams + bigrams so any substring of an unspaced run lands on a token.
function cjkGrams(word: string): string[] {
  const grams: string[] = []
  for (const run of word.match(CJK_RUN) ?? []) {
    const characters = run.split('')
    grams.push(...characters)
    for (let i = 1; i < characters.length; i++) {
      grams.push(characters[i - 1] + characters[i])
    }
  }
  return grams
}

/**
 * Emits sub-parts so a term matches however it's typed: `-`/`_` splits, a
 * trailing version (`wan2.7` → `wan`, `2.7`), and CJK character grams.
 */
export function tokenize(text: string): string[] {
  const tokens = new Set<string>()
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    for (const gram of cjkGrams(word)) tokens.add(gram)
    // A pure-CJK run has no whole-word token — its grams already cover it.
    if (CJK.test(word) && !/[a-z0-9]/.test(word)) continue
    tokens.add(word)
    for (const part of word.split(/[-_]/)) {
      if (part) tokens.add(part)
    }
    const version = word.match(/^([a-z][a-z.]*?)(\d+(?:\.\d+)*)$/)
    if (version) {
      tokens.add(version[1].replace(/\.$/, ''))
      tokens.add(version[2])
    }
  }
  return [...tokens]
}

// Exact for ≤3-char and digit-bearing terms; otherwise 20% of length, so a typo
// is forgiven but `upscale` can't fuzzy-match the shorter `scale`.
export function termFuzziness(term: string): number | false {
  return term.length <= 3 || /\d/.test(term) ? false : 0.2
}

function searchOptions(combineWith: 'AND' | 'OR' = 'AND') {
  // Description demoted below default so an incidental prose mention never
  // outranks a real title/model match.
  return {
    boost: { title: 3, models: 2, tags: 2, description: 0.5 },
    prefix: true,
    fuzzy: termFuzziness,
    combineWith,
    tokenize
  }
}

// `{X}2{Y}` shorthand expanded by structure (t2i, txt2img, …) rather than one
// entry per spelling.
const MODALITY_STEMS: Record<string, string> = {
  t: 'text',
  txt: 'text',
  text: 'text',
  i: 'image',
  img: 'image',
  image: 'image',
  v: 'video',
  vid: 'video',
  video: 'video',
  a: 'audio',
  s: 'audio',
  m: 'music'
}

const SAME_MODALITY_EDIT: Record<string, string> = {
  image: 'image edit',
  video: 'video edit',
  audio: 'audio edit'
}

const ACRONYMS: Record<string, string> = {
  cn: 'controlnet'
}

export function expandAbbreviation(token: string): string | null {
  const lower = token.trim().toLowerCase()
  if (ACRONYMS[lower]) return ACRONYMS[lower]

  const match = lower.match(/^([a-z]+)2([a-z]+)$/)
  if (!match) return null
  const left = MODALITY_STEMS[match[1]]
  const right = MODALITY_STEMS[match[2]]
  if (!left || !right) return null
  if (left === right) return SAME_MODALITY_EDIT[left] ?? left
  return `${left} ${right}`
}

/** Expands shorthand tokens (`wan i2v` → `wan image video`); null if none expand. */
export function expandQuery(query: string): string | null {
  let changed = false
  const out = query
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const expansion = expandAbbreviation(token.toLowerCase())
      if (expansion) changed = true
      return expansion ?? token
    })
    .join(' ')
  return changed ? out : null
}

export function createTemplateSearchIndex(
  templates: TemplateInfo[]
): MiniSearch<TemplateInfo> {
  const index = new MiniSearch<TemplateInfo>({
    idField: 'name',
    fields: [...SEARCH_FIELDS],
    // Returned on each hit so the tiebreak can read usage without a second lookup.
    storeFields: ['usage'],
    // Index the localized strings the card actually shows, so a match explains
    // a visible result.
    extractField: (template, field) => {
      if (field === 'title') return template.localizedTitle ?? template.title
      if (field === 'description') {
        return template.localizedDescription ?? template.description ?? ''
      }
      const value = template[field as keyof TemplateInfo]
      return Array.isArray(value) ? value.join(' ') : ((value as string) ?? '')
    },
    tokenize,
    searchOptions: searchOptions('AND')
  })
  index.addAll(templates)
  return index
}

// Rank by relevance, with usage breaking ties inside a score band. Scores are
// bucketed so the ordering is a stable total order (a pairwise relative-band
// compare is intransitive). log1p dampens heavy-tailed usage.
export function rankByRelevanceThenUsage(hits: SearchResult[]): SearchResult[] {
  const bandSize =
    hits.reduce((max, hit) => Math.max(max, hit.score), 0) * USAGE_TIEBREAK_BAND
  const bucket = (score: number) =>
    bandSize > 0 ? Math.round(score / bandSize) : 0
  return [...hits].sort((a, b) => {
    if (bucket(a.score) !== bucket(b.score)) return b.score - a.score
    return Math.log1p(Number(b.usage ?? 0)) - Math.log1p(Number(a.usage ?? 0))
  })
}

/** Ordered template names for a query: literal matches first, then dedup'd expansion matches. */
export function searchTemplates(
  index: MiniSearch<TemplateInfo>,
  query: string
): string[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const andThenOr = (q: string): SearchResult[] => {
    const and = index.search(q, searchOptions('AND'))
    const hits = and.length > 0 ? and : index.search(q, searchOptions('OR'))
    return rankByRelevanceThenUsage(hits)
  }

  const ordered: string[] = []
  const seen = new Set<string>()
  const collect = (hits: SearchResult[]) => {
    for (const hit of hits) {
      const id = String(hit.id)
      if (!seen.has(id)) {
        seen.add(id)
        ordered.push(id)
      }
    }
  }

  collect(andThenOr(trimmed))
  const expanded = expandQuery(trimmed)
  if (expanded) collect(andThenOr(expanded))

  return ordered
}
