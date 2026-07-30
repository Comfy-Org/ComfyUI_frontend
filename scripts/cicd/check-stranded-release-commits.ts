export interface Commit {
  sha: string
  subject: string
}

export type FindingKind =
  | 'stranded-commits'
  | 'published-version-lag'
  | 'published-version-missing'

export interface Finding {
  kind: FindingKind
  branch: string
  severity: 'failure' | 'notice'
  message: string
  strandedFixCount: number
}

export interface LineInput {
  branch: string
  latestTag: string
  publishedVersion: string | null
  commits: Commit[]
}

export function minorLineOf(_version: string): string | null {
  throw new Error('not implemented')
}

export function releaseBranchFor(_minorLine: string): string {
  throw new Error('not implemented')
}

export function classifyCommits(_commits: Commit[]): {
  fixes: Commit[]
  others: Commit[]
} {
  throw new Error('not implemented')
}

export function evaluateLine(_input: LineInput): {
  findings: Finding[]
  failed: boolean
} {
  throw new Error('not implemented')
}
