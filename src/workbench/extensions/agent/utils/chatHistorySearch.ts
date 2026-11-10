export type ChatSearchField = 'title' | 'preview' | 'workflowName'

/**
 * Minimal shape the search needs. The client `ChatSession` can satisfy this
 * once it carries `preview` and a resolved workflow name.
 */
export interface ChatSearchable {
  id: string
  title: string
  preview?: string
  workflowName?: string
}

/** Half-open `[start, end)` UTF-16 range into the original field text. */
export interface ChatSearchRange {
  start: number
  end: number
}

export interface ChatSearchResult<T extends ChatSearchable> {
  session: T
  /** Fields containing at least one query word, in row order. */
  matchedFields: ChatSearchField[]
  /** Sorted, merged, non-overlapping ranges for each matched field. */
  ranges: Partial<Record<ChatSearchField, ChatSearchRange[]>>
}

const FIELDS: readonly ChatSearchField[] = ['title', 'preview', 'workflowName']

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findOccurrences(text: string, matcher: RegExp): ChatSearchRange[] {
  const found: ChatSearchRange[] = []
  matcher.lastIndex = 0
  for (let m = matcher.exec(text); m; m = matcher.exec(text)) {
    found.push({ start: m.index, end: m.index + m[0].length })
    // Step by one so overlapping occurrences (e.g. "aa" in "aaa") are seen.
    matcher.lastIndex = m.index + 1
  }
  return found
}

function mergeRanges(ranges: ChatSearchRange[]): ChatSearchRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: ChatSearchRange[] = []
  for (const range of sorted) {
    const last = merged.at(-1)
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

/**
 * Filters sessions by a free-text query.
 *
 * Matching is a case-insensitive substring test with no accent folding. The
 * query is split on whitespace; every word must match at least one of title,
 * preview or workflow name (different words may match different fields).
 *
 * Returns `null` when the query is empty or whitespace-only, meaning the
 * caller should not filter. Otherwise returns matches in input order.
 */
export function searchChatHistory<T extends ChatSearchable>(
  sessions: readonly T[],
  query: string
): ChatSearchResult<T>[] | null {
  const words = query.split(/\s+/).filter(Boolean)
  if (words.length === 0) return null

  const matchers = words.map((word) => new RegExp(escapeRegExp(word), 'gi'))
  const results: ChatSearchResult<T>[] = []

  for (const session of sessions) {
    const collected: Partial<Record<ChatSearchField, ChatSearchRange[]>> = {}
    let everyWordMatched = true

    for (const matcher of matchers) {
      let wordMatched = false
      for (const field of FIELDS) {
        const found = findOccurrences(session[field] ?? '', matcher)
        if (found.length === 0) continue
        wordMatched = true
        collected[field] = [...(collected[field] ?? []), ...found]
      }
      if (!wordMatched) {
        everyWordMatched = false
        break
      }
    }
    if (!everyWordMatched) continue

    const matchedFields = FIELDS.filter((field) => collected[field])
    const ranges: ChatSearchResult<T>['ranges'] = {}
    for (const field of matchedFields) {
      ranges[field] = mergeRanges(collected[field] ?? [])
    }
    results.push({ session, matchedFields, ranges })
  }

  return results
}
