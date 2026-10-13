import { POLICY_REVIEW_PREFIX } from '../policy.ts'
import type {
  FastLaneConfig,
  PullRequest,
  PullRequestReview
} from '../types.ts'

export const repository = 'Comfy-Org/ComfyUI_frontend'
export const headSha = '0123456789abcdef0123456789abcdef01234567'
export const floorTime = '2026-10-06T10:00:00Z'

export const lane: FastLaneConfig = {
  id: 'website',
  pathPrefixes: ['apps/website/'],
  approval: {
    identity: 'christian-byrne',
    trustedAuthors: ['bertfy'],
    approvalLabel: 'website-fast-lane:approve',
    trustedLabelers: ['drjkl'],
    holdLabel: 'website-fast-lane:hold'
  }
}

export const operatorLabelEvent = {
  actor: 'drjkl',
  label: 'website-fast-lane:approve'
}

export function pullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    state: 'open',
    draft: false,
    node_id: 'PR_1',
    changed_files: 1,
    user: { login: 'bertfy' },
    labels: [],
    head: { sha: headSha, repo: { full_name: repository } },
    base: { ref: 'main', repo: { full_name: repository } },
    ...overrides
  }
}

export function outsider(labels: string[]): Partial<PullRequest> {
  return {
    user: { login: 'someone-else' },
    labels: labels.map((name) => ({ name }))
  }
}

export function policyApproval(
  overrides: Partial<PullRequestReview> = {}
): PullRequestReview {
  return {
    state: 'APPROVED',
    commit_id: headSha,
    body: `${POLICY_REVIEW_PREFIX} Lane: website.`,
    submitted_at: floorTime,
    user: { login: 'christian-byrne' },
    ...overrides
  }
}
