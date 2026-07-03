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

/**
 * Also emits sub-parts so an identifier matches however it's typed: `-`/`_`
 * splits (`video_ltx2_3_t2v` → `t2v`) and a trailing version splits off its name
 * (`wan2.7` → `wan`, `2.7`, so `wan 2.7` matches too).
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    tokens.push(word)
    const parts = new Set<string>()
    for (const part of word.split(/[-_]/)) {
      if (part) parts.add(part)
    }
    const version = word.match(/^([a-z][a-z.]*?)(\d+(?:\.\d+)*)$/)
    if (version) {
      parts.add(version[1].replace(/\.$/, ''))
      parts.add(version[2])
    }
    parts.delete(word)
    tokens.push(...parts)
  }
  return tokens
}

// Exact for ≤3-char and digit-bearing terms so `2.5` ≠ `3.5` and short noise
// doesn't over-match; ~2 edits otherwise (forgives `conrtol` → `control`).
export function termFuzziness(term: string): number | false {
  return term.length <= 3 || /\d/.test(term) ? false : 0.3
}

function searchOptions(combineWith: 'AND' | 'OR' = 'AND') {
  // Description demoted below default so an incidental prose mention never
  // outranks a real title/model match.
  return {
    boost: { title: 3, models: 2, tags: 2, description: 0.5 },
    prefix: true,
    fuzzy: (term: string) => termFuzziness(term),
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

// log1p compresses heavy-tailed usage so one mega-popular template can't
// dominate the tiebreak.
function usageTiebreak(a: SearchResult, b: SearchResult): number {
  const top = Math.max(a.score, b.score)
  if (top > 0 && Math.abs(a.score - b.score) / top <= USAGE_TIEBREAK_BAND) {
    return Math.log1p(Number(b.usage ?? 0)) - Math.log1p(Number(a.usage ?? 0))
  }
  return b.score - a.score
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
    return hits.sort(usageTiebreak)
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
