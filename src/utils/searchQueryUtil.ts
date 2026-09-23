import { words } from 'es-toolkit/compat'

const REPO_OWNER_PREFIX = /^[A-Za-z0-9._-]+\/(\S.*)$/

const startsWithDigit = (value: string) => /^\d/.test(value)
const endsWithDigit = (value: string) => /\d$/.test(value)
const startsLowercase = (value: string) => /^[a-z]/.test(value)

/**
 * Drops the `owner/` half of a GitHub-style `owner/repo` slug.
 *
 * Pasted slugs are the single largest source of zero-result pack searches: the
 * owner segment is a required term that usually appears in no indexed
 * attribute, so it zeroes out an otherwise-matching query.
 *
 * @example
 * stripRepoOwner('kijai/comfyui-kjnodes') // 'comfyui-kjnodes'
 * stripRepoOwner('comfyui-kjnodes') // 'comfyui-kjnodes'
 */
export function stripRepoOwner(query: string): string {
  return REPO_OWNER_PREFIX.exec(query.trim())?.[1] ?? query
}

/**
 * Splits a compound identifier into its constituent words and rejoins them
 * with spaces, so a search backend with no camelCase/PascalCase
 * word-segmentation of its own (e.g. Algolia) can match a compound query
 * term-by-term instead of as one unsegmented blob.
 *
 * Splits on camelCase/PascalCase transitions, hyphens and underscores, while
 * keeping acronym runs like `SDXL` intact. An unpunctuated letter/digit run is
 * also kept whole so version-bearing model names stay searchable as written --
 * splitting `seedvr2` into `seedvr 2` matches on the bare digit and drags in
 * unrelated packs. A separator in the source still splits, so `qwen3-vl` keeps
 * `vl` as its own term.
 *
 * @example
 * tokenizeCompoundWords('EulerDiscreteScheduler') // 'Euler Discrete Scheduler'
 * tokenizeCompoundWords('seedvr2') // 'seedvr2'
 * tokenizeCompoundWords('qwen3-vl') // 'qwen3 vl'
 * tokenizeCompoundWords('already spaced') // 'already spaced'
 */
export function tokenizeCompoundWords(input: string): string {
  const tokens: string[] = []
  let searchFrom = 0
  let previousEnd = -1

  for (const word of words(input)) {
    const start = input.indexOf(word, searchFrom)
    const previous = tokens.at(-1)
    const isUnpunctuatedBoundary = start === previousEnd

    searchFrom = start + word.length
    previousEnd = searchFrom

    const continuesAlphanumericRun =
      previous !== undefined &&
      isUnpunctuatedBoundary &&
      (endsWithDigit(previous) ? startsLowercase(word) : startsWithDigit(word))

    if (continuesAlphanumericRun) tokens[tokens.length - 1] = previous + word
    else tokens.push(word)
  }

  return tokens.join(' ')
}

/**
 * Ordered fallback queries to try alongside a pack search, most precise first.
 * Excludes any candidate identical to the original query, so a query that
 * needs no rewriting costs no extra requests.
 */
export function buildPackSearchFallbacks(query: string): string[] {
  const withoutOwner = stripRepoOwner(query)
  const seen = new Set([query])

  return [withoutOwner, tokenizeCompoundWords(withoutOwner)].filter(
    (candidate) => {
      if (candidate.length === 0 || seen.has(candidate)) return false
      seen.add(candidate)
      return true
    }
  )
}
