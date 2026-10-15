import { uniq } from 'es-toolkit'

const GITHUB_REPO_URL =
  /^(?:git@github\.com:|(?:https?:\/\/)?(?:www\.)?github\.com\/)[a-z0-9-]+\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i

const BARE_COMPOUND_REPO_SLUG =
  /^[a-z0-9-]+\/([\w.-]*?[a-z0-9][-_][a-z0-9][\w.-]*?)(?:\.git)?\/?$/i

const TRAILING_GIT_OR_SLASHES = /(?:\.git)?\/*$/i

const WORD_SEPARATORS = /[\s_-]+/

const WHITESPACE_RUN = /\s+/g

export function stripRepoOwner(query: string): string {
  return (
    GITHUB_REPO_URL.exec(query)?.[1] ??
    BARE_COMPOUND_REPO_SLUG.exec(query)?.[1] ??
    query
  )
}

export function toRepoName(query: string): string {
  return stripRepoOwner(query.trim().replace(TRAILING_GIT_OR_SLASHES, ''))
}

export function splitOnSeparators(input: string): string {
  return input.split(WORD_SEPARATORS).filter(Boolean).join(' ')
}

function collapseWhitespace(input: string): string {
  return input.replace(WHITESPACE_RUN, ' ')
}

export function buildPackSearchFallbacks(query: string): string[] {
  const trimmedQuery = query.trim()
  const normalizedQuery = collapseWhitespace(trimmedQuery)
  const repoName = toRepoName(trimmedQuery)
  return uniq([repoName, splitOnSeparators(repoName)]).filter(
    (candidate) =>
      candidate.length > 0 && collapseWhitespace(candidate) !== normalizedQuery
  )
}
