import { uniq } from 'es-toolkit'

const GITHUB_REPO_URL =
  /^(?:git@github\.com:|(?:https?:\/\/)?(?:www\.)?github\.com\/)[a-z0-9-]+\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i

const BARE_REPO_SLUG = /^[A-Za-z0-9-]+\/([\w.-]+)$/

const COMPOUND_WORD_JOIN = /[A-Za-z0-9][-_][A-Za-z0-9]/

const SLASH_OR_SPACE = /[\s/]/

const GIT_SUFFIX = '.git'

const WORD_SEPARATORS = /[\s_-]+/

const WHITESPACE_RUN = /\s+/g

function endsWithGitSuffix(input: string, end: number): boolean {
  const start = end - GIT_SUFFIX.length
  return start >= 0 && input.slice(start, end).toLowerCase() === GIT_SUFFIX
}

function stripTrailingRun(
  input: string,
  { stripGit }: { stripGit: boolean }
): string {
  let end = input.length
  while (end > 0) {
    if (SLASH_OR_SPACE.test(input[end - 1])) {
      end -= 1
    } else if (stripGit && endsWithGitSuffix(input, end)) {
      end -= GIT_SUFFIX.length
    } else {
      break
    }
  }
  return input.slice(0, end)
}

function bareCompoundRepoName(query: string): string | undefined {
  const repoName = BARE_REPO_SLUG.exec(query)?.[1]
  return repoName && COMPOUND_WORD_JOIN.test(repoName) ? repoName : undefined
}

function stripRepoOwner(query: string): string {
  return (
    GITHUB_REPO_URL.exec(query)?.[1] ?? bareCompoundRepoName(query) ?? query
  )
}

export function toRepoName(query: string): string {
  return stripRepoOwner(stripTrailingRun(query.trim(), { stripGit: true }))
}

export function splitOnSeparators(input: string): string {
  return input.split(WORD_SEPARATORS).filter(Boolean).join(' ')
}

function toComparableQuery(input: string): string {
  return stripTrailingRun(input.trim(), { stripGit: false }).replace(
    WHITESPACE_RUN,
    ' '
  )
}

export function buildPackSearchFallbacks(query: string): string[] {
  const comparableQuery = toComparableQuery(query)
  const repoName = toRepoName(query)
  return uniq([repoName, splitOnSeparators(repoName)]).filter(
    (candidate) =>
      candidate.length > 0 && toComparableQuery(candidate) !== comparableQuery
  )
}
