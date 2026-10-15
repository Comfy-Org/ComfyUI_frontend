import { uniq } from 'es-toolkit'

const GITHUB_REPO_URL =
  /^(?:git@github\.com:|(?:https?:\/\/)?(?:www\.)?github\.com\/)[a-z0-9-]+\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i

const BARE_COMPOUND_REPO_SLUG =
  /^[A-Za-z0-9-]+\/([\w.-]*[A-Za-z0-9][-_.][A-Za-z0-9][\w.-]*)$/

const WORD_SEPARATORS = /[\s_-]+/

export function stripRepoOwner(query: string): string {
  return (
    GITHUB_REPO_URL.exec(query)?.[1] ??
    BARE_COMPOUND_REPO_SLUG.exec(query)?.[1] ??
    query
  )
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
