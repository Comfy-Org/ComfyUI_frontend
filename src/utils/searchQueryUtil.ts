import { uniq } from 'es-toolkit'

const REPO_OWNER_PREFIX =
  /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?[A-Za-z0-9-]+\/(\S.*)$/

const WORD_SEPARATORS = /[\s_-]+/

export function stripRepoOwner(query: string): string {
  return REPO_OWNER_PREFIX.exec(query.trim())?.[1] ?? query
}

export function splitOnSeparators(input: string): string {
  return input.split(WORD_SEPARATORS).filter(Boolean).join(' ')
}

export function buildPackSearchFallbacks(query: string): string[] {
  const trimmedQuery = query.trim()
  const withoutOwner = stripRepoOwner(trimmedQuery)
  return uniq([withoutOwner, splitOnSeparators(withoutOwner)]).filter(
    (candidate) => candidate.length > 0 && candidate !== trimmedQuery
  )
}
