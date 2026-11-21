import assert from 'node:assert/strict'
import { test } from 'node:test'

import { dispatchReview } from './dispatch-shh-review.ts'

const env = {
  GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
  GITHUB_TOKEN: 'github-test-token',
  SWARMHOST_TOKEN: 'swarmhost-test-token',
  SWARMHOST_REVIEW_ENABLED: 'true',
  SWARMHOST_REVIEW_PLAYBOOK_ID: '11111111-1111-4111-8111-111111111111',
  SWARMHOST_REVIEW_PROJECT_ID: '22222222-2222-4222-8222-222222222222',
  SWARMHOST_REVIEW_PLAYBOOK_VERSION: '3'
}

function transport(overrides: Record<string, unknown> = {}, status = 202) {
  const dispatched: unknown[] = []
  const fetcher: typeof fetch = async (input, options) => {
    const url = String(input)
    if (url.startsWith('https://api.github.com/')) {
      return Response.json({
        state: 'open',
        draft: false,
        user: { login: 'contributor' },
        assignees: [{ login: 'huang47' }],
        requested_reviewers: [],
        head: { sha: 'a'.repeat(40) },
        ...overrides
      })
    }
    assert.equal(
      url,
      'https://swarmhost.engcomfy.com/api/playbooks/11111111-1111-4111-8111-111111111111/dispatch'
    )
    assert.equal(options?.method, 'POST')
    assert.equal(options.redirect, 'error')
    assert.equal(
      new Headers(options.headers).get('Authorization'),
      'Bearer swarmhost-test-token'
    )
    assert.equal(typeof options.body, 'string')
    assert.ok(typeof options.body === 'string')
    dispatched.push(JSON.parse(options.body))
    return Response.json({ id: 'dispatch-123', status: 'queued' }, { status })
  }
  return { fetcher, dispatched }
}

test('dispatches live head metadata despite a stale event snapshot', async () => {
  const { fetcher, dispatched } = transport()
  const result = await dispatchReview(
    { number: 42, pull_request: { head: { sha: 'b'.repeat(40) } } },
    env,
    fetcher
  )
  assert.equal(result, 'Review dispatch dispatch-123: queued')
  assert.deepEqual(dispatched, [
    {
      version: 3,
      target_project_id: '22222222-2222-4222-8222-222222222222',
      client_request_id:
        'shh-review:Comfy-Org/ComfyUI_frontend:42:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      params: {
        repo_full_name: 'Comfy-Org/ComfyUI_frontend',
        pr_number: '42',
        head_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        pr_url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/42'
      }
    }
  ])
})

test('duplicate delivery uses the same server idempotency key', async () => {
  const { fetcher, dispatched } = transport()
  await dispatchReview({ number: 42, action: 'assigned' }, env, fetcher)
  await dispatchReview({ number: 42, action: 'synchronize' }, env, fetcher)
  assert.equal(dispatched.length, 2)
  assert.deepEqual(dispatched[0], dispatched[1])
})

test('a new current head gets a different dispatch key', async () => {
  const first = transport()
  const next = transport({ head: { sha: 'b'.repeat(40) } })
  await dispatchReview({ number: 42 }, env, first.fetcher)
  await dispatchReview({ number: 42 }, env, next.fetcher)
  assert.notDeepEqual(first.dispatched, next.dispatched)
  assert.match(
    JSON.stringify(next.dispatched),
    /shh-review:Comfy-Org\/ComfyUI_frontend:42:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/
  )
})

const eligibilityCases = [
  { name: 'closed', changes: { state: 'closed' }, eligible: false },
  { name: 'draft', changes: { draft: true }, eligible: false },
  {
    name: 'own PR',
    changes: { user: { login: 'huang47' } },
    eligible: false
  },
  { name: 'unassigned', changes: { assignees: [] }, eligible: false },
  {
    name: 'requested reviewer',
    changes: { assignees: [], requested_reviewers: [{ login: 'huang47' }] },
    eligible: true
  }
]

for (const { name, changes, eligible } of eligibilityCases) {
  test(`live eligibility: ${name}`, async () => {
    const { fetcher, dispatched } = transport(changes)
    await dispatchReview({ number: 42 }, env, fetcher)
    assert.equal(dispatched.length, Number(eligible))
  })
}

test('disabled runs do not read metadata or dispatch', async () => {
  const fetcher: typeof fetch = async () => {
    assert.fail('Disabled dispatch must not access the network')
  }
  assert.equal(await dispatchReview({}, {}, fetcher), 'Disabled')
})

test('a failed dispatch response fails the workflow', async () => {
  const { fetcher } = transport({}, 503)
  await assert.rejects(dispatchReview({ number: 42 }, env, fetcher), /HTTP 503/)
})

test('metadata lookup failure never dispatches', async () => {
  const fetcher: typeof fetch = async (input) => {
    assert.ok(String(input).startsWith('https://api.github.com/'))
    return Response.json({}, { status: 403 })
  }
  await assert.rejects(dispatchReview({ number: 42 }, env, fetcher), /HTTP 403/)
})

test('an unsuccessful dispatch row fails even when HTTP succeeds', async () => {
  const { fetcher } = transport()
  const failed: typeof fetch = async (input, options) =>
    String(input).startsWith('https://api.github.com/')
      ? fetcher(input, options)
      : Response.json({ id: 'dispatch-123', status: 'failed' })
  await assert.rejects(
    dispatchReview({ number: 42 }, env, failed),
    /did not accept/
  )
})
