import { uniq } from 'es-toolkit'

const GITHUB_REPO_URL =
  /^(?:git@github\.com:|(?:https?:\/\/)?(?:www\.)?github\.com\/)[a-z0-9-]+\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i

const BARE_COMPOUND_REPO_SLUG =
  /^[A-Za-z0-9-]+\/([\w.-]*[A-Za-z0-9][-_][A-Za-z0-9][\w.-]*)$/

const TRAILING_GIT_SLASHES_OR_SPACES = /(?:\.git|[\s/])+$/i

const TRAILING_SLASHES_OR_SPACES = /[\s/]+$/

const WORD_SEPARATORS = /[\s_-]+/

const WHITESPACE_RUN = /\s+/g

function stripRepoOwner(query: string): string {
  return (
    GITHUB_REPO_URL.exec(query)?.[1] ??
    BARE_COMPOUND_REPO_SLUG.exec(query)?.[1] ??
    query
  )
}

export function toRepoName(query: string): string {
  return stripRepoOwner(
    query.trim().replace(TRAILING_GIT_SLASHES_OR_SPACES, '')
  )
}

export function splitOnSeparators(input: string): string {
  return input.split(WORD_SEPARATORS).filter(Boolean).join(' ')
}

function toComparableQuery(input: string): string {
  return input
    .trim()
    .replace(TRAILING_SLASHES_OR_SPACES, '')
    .replace(WHITESPACE_RUN, ' ')
}

export function buildPackSearchFallbacks(query: string): string[] {
  const comparableQuery = toComparableQuery(query)
  const repoName = toRepoName(query)
  return uniq([repoName, splitOnSeparators(repoName)]).filter(
    (candidate) =>
      candidate.length > 0 && toComparableQuery(candidate) !== comparableQuery
  )
}
