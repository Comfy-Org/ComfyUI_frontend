import assert from 'node:assert/strict'
import test from 'node:test'

import {
  armMergeAutomation,
  approveCurrentHead,
  alreadyApprovedCurrentHead,
  changedPaths,
  hasActiveChangeRequest,
  hasAuthorizedApprovalLabel,
  hasCompleteChangedFileList,
  hasHoldLabel,
  isSameRepository,
  isWebsiteOnly,
  parseApprovedAuthors,
  stopMergeAutomation,
  targetsDefaultBranch
} from './website-auto-approve.mjs'

void test('a failed post-approval verification withdraws the new approval', async () => {
  const calls = []
  const verificationError = new Error('verification unavailable')
  const github = {
    async request(requestPath, options = {}) {
      calls.push({ requestPath, method: options.method ?? 'GET' })
      if (options.method === 'POST') return { id: 123 }
      if (options.method === 'PUT') return null
      throw verificationError
    },
    async paginate() {
      throw new Error('review verification should not run after pull failure')
    }
  }

  await assert.rejects(
    approveCurrentHead(
      github,
      { prNumber: 42, expectedApprover: 'christian-byrne' },
      '0123456789abcdef0123456789abcdef01234567',
      []
    ),
    verificationError
  )
  assert.deepEqual(calls, [
    { requestPath: '/pulls/42/reviews', method: 'POST' },
    { requestPath: '/pulls/42', method: 'GET' },
    { requestPath: '/pulls/42/reviews/123/dismissals', method: 'PUT' }
  ])
})

void test('requires complete changed-file enumeration', () => {
  const files = [{ filename: 'apps/website/a.astro' }]
  assert.equal(hasCompleteChangedFileList(files, 1), true)
  assert.equal(hasCompleteChangedFileList(files, 2), false)
  assert.equal(hasCompleteChangedFileList(files, undefined), false)
})

void test('parses and normalizes the explicit author allowlist', () => {
  assert.deepEqual(
    parseApprovedAuthors('["bertfy", "BERTFY", ""]'),
    new Set(['bertfy'])
  )
  assert.throws(() => parseApprovedAuthors('bertfy'), /must be JSON/)
  assert.throws(
    () => parseApprovedAuthors('{"bertfy":true}'),
    /must be a JSON array/
  )
})

void test('requires a non-empty website-only path set', () => {
  assert.equal(isWebsiteOnly(['apps/website/src/pages/index.astro']), true)
  assert.equal(
    isWebsiteOnly([
      'apps/website/src/pages/index.astro',
      'apps/website/public/hero.webp'
    ]),
    true
  )
  assert.equal(isWebsiteOnly([]), false)
  assert.equal(
    isWebsiteOnly(['apps/website/src/pages/index.astro', 'pnpm-lock.yaml']),
    false
  )
  assert.equal(isWebsiteOnly(['apps/website-evil/file.ts']), false)
})

void test('a rename must stay inside the website on both sides', () => {
  assert.deepEqual(
    changedPaths([
      {
        status: 'renamed',
        previous_filename: 'apps/website/old.astro',
        filename: 'apps/website/new.astro'
      }
    ]),
    ['apps/website/new.astro', 'apps/website/old.astro']
  )
  const crossBoundaryRename = changedPaths([
    {
      status: 'renamed',
      previous_filename: 'src/sensitive.ts',
      filename: 'apps/website/sensitive.ts'
    }
  ])
  assert.equal(isWebsiteOnly(crossBoundaryRename), false)
  assert.equal(
    changedPaths([{ status: 'renamed', filename: 'apps/website/new.astro' }]),
    null
  )
})

void test('a copied file retains both paths for boundary evaluation', () => {
  assert.deepEqual(
    changedPaths([
      {
        status: 'copied',
        previous_filename: 'src/sensitive.ts',
        filename: 'apps/website/sensitive.ts'
      }
    ]),
    ['apps/website/sensitive.ts', 'src/sensitive.ts']
  )
})

void test('the explicit hold label stops fast-lane approval', () => {
  assert.equal(hasHoldLabel({ labels: [] }), false)
  assert.equal(
    hasHoldLabel({ labels: [{ name: 'website-fast-lane:hold' }] }),
    true
  )
  assert.equal(
    hasHoldLabel({ labels: [{ name: 'WEBSITE-FAST-LANE:HOLD' }] }),
    true
  )
})

void test('approval label requires provenance from an authorized operator', () => {
  const pull = { labels: [{ name: 'website-fast-lane:approve' }] }
  const authorized = new Set(['drjkl'])
  assert.equal(
    hasAuthorizedApprovalLabel(
      pull,
      [
        { event: 'committed' },
        {
          event: 'labeled',
          label: { name: 'website-fast-lane:approve' },
          actor: { login: 'DrJKL' }
        }
      ],
      authorized
    ),
    true
  )
  assert.equal(
    hasAuthorizedApprovalLabel(
      pull,
      [
        { event: 'committed' },
        {
          event: 'labeled',
          label: { name: 'website-fast-lane:approve' },
          actor: { login: 'not-authorized' }
        }
      ],
      authorized
    ),
    false
  )
  assert.equal(
    hasAuthorizedApprovalLabel(
      { labels: [] },
      [
        { event: 'committed' },
        {
          event: 'labeled',
          label: { name: 'website-fast-lane:approve' },
          actor: { login: 'DrJKL' }
        }
      ],
      authorized
    ),
    false
  )
  assert.equal(
    hasAuthorizedApprovalLabel(
      pull,
      [
        {
          event: 'labeled',
          label: { name: 'website-fast-lane:approve' },
          actor: { login: 'DrJKL' }
        },
        { event: 'committed' }
      ],
      authorized
    ),
    false
  )
})

void test('only each non-app reviewer latest state can actively block', () => {
  assert.equal(
    hasActiveChangeRequest([
      {
        state: 'CHANGES_REQUESTED',
        user: { login: 'coderabbitai[bot]', type: 'Bot' }
      },
      {
        state: 'CHANGES_REQUESTED',
        user: { login: 'DrJKL', type: 'User' }
      },
      { state: 'APPROVED', user: { login: 'DrJKL', type: 'User' } }
    ]),
    false
  )
  assert.equal(
    hasActiveChangeRequest([
      {
        state: 'CHANGES_REQUESTED',
        user: { login: 'human-reviewer', type: 'User' }
      }
    ]),
    true
  )
  assert.equal(
    hasActiveChangeRequest([
      {
        state: 'CHANGES_REQUESTED',
        user: { login: 'DrJKL', type: 'User' }
      },
      { state: 'COMMENTED', user: { login: 'DrJKL', type: 'User' } }
    ]),
    true
  )
})

void test('fork pull requests are not eligible', () => {
  assert.equal(
    isSameRepository(
      { head: { repo: { full_name: 'Comfy-Org/ComfyUI_frontend' } } },
      'comfy-org/comfyui_frontend'
    ),
    true
  )
  assert.equal(
    isSameRepository(
      { head: { repo: { full_name: 'bertfy/ComfyUI_frontend' } } },
      'Comfy-Org/ComfyUI_frontend'
    ),
    false
  )
  assert.equal(
    isSameRepository({ head: { repo: null } }, 'Comfy-Org/ComfyUI_frontend'),
    false
  )
})

void test('only pull requests targeting the default branch are eligible', () => {
  assert.equal(
    targetsDefaultBranch(
      {
        base: {
          ref: 'main',
          repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
        }
      },
      'comfy-org/comfyui_frontend',
      'main'
    ),
    true
  )
  assert.equal(
    targetsDefaultBranch(
      {
        base: {
          ref: 'release',
          repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
        }
      },
      'Comfy-Org/ComfyUI_frontend',
      'main'
    ),
    false
  )
})

void test('idempotency is scoped to Christian and the exact head commit', () => {
  const reviews = [
    { state: 'APPROVED', commit_id: 'old', user: { login: 'christian-byrne' } },
    { state: 'APPROVED', commit_id: 'head', user: { login: 'someone-else' } },
    {
      state: 'CHANGES_REQUESTED',
      commit_id: 'head',
      user: { login: 'christian-byrne' }
    }
  ]
  assert.equal(
    alreadyApprovedCurrentHead(reviews, 'christian-byrne', 'head'),
    false
  )
  reviews.push({
    state: 'APPROVED',
    commit_id: 'head',
    user: { login: 'Christian-Byrne' }
  })
  assert.equal(
    alreadyApprovedCurrentHead(reviews, 'christian-byrne', 'head'),
    true
  )
})

void test('arms native auto-merge for the exact head with squash', async () => {
  const calls = []
  const github = {
    async graphql(query, variables) {
      calls.push({ query, variables })
      if (calls.length === 1) {
        return {
          node: {
            id: 'PR_1',
            headRefOid: 'head-sha',
            mergeStateStatus: 'BLOCKED',
            autoMergeRequest: null,
            mergeQueueEntry: null
          }
        }
      }
      return { enablePullRequestAutoMerge: { clientMutationId: null } }
    }
  }
  await armMergeAutomation(
    github,
    { expectedApprover: 'christian-byrne' },
    { node_id: 'PR_1', head: { sha: 'head-sha' } }
  )
  assert.equal(calls.length, 2)
  assert.match(calls[1].query, /enablePullRequestAutoMerge/)
  assert.match(calls[1].query, /mergeMethod: SQUASH/)
  assert.deepEqual(calls[1].variables, {
    pullRequestId: 'PR_1',
    expectedHeadOid: 'head-sha'
  })
})

void test('explicitly enqueues a clean exact head without jumping the queue', async () => {
  const calls = []
  const github = {
    async graphql(query, variables) {
      calls.push({ query, variables })
      if (calls.length === 1) {
        return {
          node: {
            id: 'PR_1',
            headRefOid: 'head-sha',
            mergeStateStatus: 'CLEAN',
            autoMergeRequest: {
              enabledAt: '2026-10-06T10:01:00Z',
              enabledBy: { login: 'christian-byrne' }
            },
            mergeQueueEntry: null
          }
        }
      }
      return { enqueuePullRequest: { clientMutationId: null } }
    }
  }
  await armMergeAutomation(
    github,
    { expectedApprover: 'christian-byrne' },
    { node_id: 'PR_1', head: { sha: 'head-sha' } }
  )
  assert.equal(calls.length, 2)
  assert.match(calls[1].query, /enqueuePullRequest/)
  assert.match(calls[1].query, /jump: false/)
  assert.deepEqual(calls[1].variables, {
    pullRequestId: 'PR_1',
    expectedHeadOid: 'head-sha'
  })
})

void test('stops only merge state created after the policy review', async () => {
  const calls = []
  const github = {
    async graphql(query, variables) {
      calls.push({ query, variables })
      if (calls.length === 1) {
        return {
          node: {
            id: 'PR_1',
            headRefOid: 'head-sha',
            autoMergeRequest: {
              enabledAt: '2026-10-06T10:01:00Z',
              enabledBy: { login: 'christian-byrne' }
            },
            mergeQueueEntry: {
              id: 'MQE_1',
              enqueuedAt: '2026-10-06T10:02:00Z',
              enqueuer: { login: 'christian-byrne' },
              headCommit: { oid: 'head-sha' }
            }
          }
        }
      }
      return {}
    }
  }
  await stopMergeAutomation(
    github,
    { expectedApprover: 'christian-byrne' },
    { node_id: 'PR_1', head: { sha: 'head-sha' } },
    { submitted_at: '2026-10-06T10:00:00Z' }
  )
  assert.equal(calls.length, 3)
  assert.match(calls[1].query, /dequeuePullRequest/)
  assert.match(calls[2].query, /disablePullRequestAutoMerge/)
})

void test('leaves Christian merge state that predates the workflow review alone', async () => {
  const calls = []
  const github = {
    async graphql(query, variables) {
      calls.push({ query, variables })
      return {
        node: {
          id: 'PR_1',
          headRefOid: 'head-sha',
          autoMergeRequest: {
            enabledAt: '2026-10-06T09:59:00Z',
            enabledBy: { login: 'christian-byrne' }
          },
          mergeQueueEntry: null
        }
      }
    }
  }
  await stopMergeAutomation(
    github,
    { expectedApprover: 'christian-byrne' },
    { node_id: 'PR_1', head: { sha: 'head-sha' } },
    { submitted_at: '2026-10-06T10:00:00Z' }
  )
  assert.equal(calls.length, 1)
})
