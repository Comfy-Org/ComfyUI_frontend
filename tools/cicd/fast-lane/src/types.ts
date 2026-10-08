export const MERGE_MODES = ['automatic', 'manual'] as const
export const MERGE_METHODS = ['MERGE', 'REBASE', 'SQUASH'] as const

export interface FastLaneConfig {
  schemaVersion: 1
  id: string
  pathPrefixes: string[]
  approval: {
    identity: string
    trustedAuthors: string[]
    approvalLabel: string
    trustedLabelers: string[]
    holdLabel: string
  }
  merge: {
    mode: (typeof MERGE_MODES)[number]
    method: (typeof MERGE_METHODS)[number]
  }
}

export interface RepositoryRef {
  full_name?: string
}

export interface PullRequest {
  number?: number
  state?: string
  draft?: boolean
  node_id?: string
  changed_files?: number
  user?: { login?: string }
  labels?: { name?: string }[]
  head?: { sha?: string; repo?: RepositoryRef | null }
  base?: { ref?: string; repo?: RepositoryRef | null }
}

export interface PullRequestFile {
  filename?: string
  previous_filename?: string
  status?: string
}

export interface PullRequestReview {
  id?: number
  state?: string
  body?: string
  commit_id?: string
  submitted_at?: string
  user?: { login?: string; type?: string }
}

export type SubmittedReview = PullRequestReview & { submitted_at: string }

export interface GitHubClient {
  request(path: string, options?: RequestInit): Promise<unknown>
  paginate(path: string): Promise<unknown[]>
  graphql(query: string, variables: Record<string, unknown>): Promise<unknown>
}

export interface MergeAutomationState {
  id: string
  headRefOid?: string
  mergeStateStatus?: string
  autoMergeRequest?: {
    enabledAt?: string
    enabledBy?: { login?: string }
  } | null
  mergeQueueEntry?: {
    id?: string
    enqueuedAt?: string
    enqueuer?: { login?: string }
    headCommit?: { oid?: string }
  } | null
}

export interface LabelEvent {
  actor: string
  label: string
}

export interface RuntimeConfig {
  repository: string
  pullRequestNumber: number
  eventHeadSha: string
  labelEvent?: LabelEvent
  defaultBranch: string
  lane: FastLaneConfig
}

export type Summary = (message: string) => void
