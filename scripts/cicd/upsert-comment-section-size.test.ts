import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parse } from 'yaml'
import { describe, expect, it, vi } from 'vitest'

/**
 * GitHub rejects an issue-comment body over this many characters with a 422.
 * The unified PR report is assembled from unbounded generated sections, so the
 * action has to enforce the ceiling itself.
 */
const MAX_COMMENT_LENGTH = 65536

const ACTION_PATH = join(
  import.meta.dirname,
  '../../.github/actions/upsert-comment-section/action.yaml'
)

/**
 * Runs the action's real embedded `github-script` body, so the test exercises
 * the shipped code rather than a re-implementation of it.
 */
function loadActionScript(): string {
  const action = parse(readFileSync(ACTION_PATH, 'utf8'))
  const step = action.runs.steps.find((s: { uses?: string }) =>
    s.uses?.startsWith('actions/github-script')
  )
  if (!step?.with?.script) {
    throw new Error('upsert-comment-section: github-script step not found')
  }
  return step.with.script
}

const actionScript = loadActionScript()

interface Comment {
  id: number
  user: { login: string }
  body: string
}

const COMMENT_MARKER = '<!-- COMFYUI_FRONTEND_PR_REPORT -->'

function section(name: string, content: string) {
  return `<!-- section:${name}:start -->\n${content}\n<!-- section:${name}:end -->`
}

function createHarness(options: {
  comments?: Comment[]
  updateRejection?: { status: number }
}) {
  const comments: Comment[] = options.comments ?? []
  const updateComment = vi.fn(
    async ({ comment_id, body }: { comment_id: number; body: string }) => {
      if (options.updateRejection) throw options.updateRejection
      const target = comments.find((c) => c.id === comment_id)
      if (target) target.body = body
      return { data: target }
    }
  )
  const createComment = vi.fn(async ({ body }: { body: string }) => {
    const created = {
      id: comments.length + 1,
      user: { login: 'github-actions[bot]' },
      body
    }
    comments.push(created)
    return { data: created }
  })

  const listComments = vi.fn(async () => ({ data: comments }))
  const github = {
    paginate: async (fn: typeof listComments) => (await fn()).data,
    rest: {
      issues: {
        listComments,
        createComment,
        updateComment,
        deleteComment: vi.fn(async () => ({})),
        getComment: vi.fn(async ({ comment_id }: { comment_id: number }) => ({
          data: comments.find((c) => c.id === comment_id)
        }))
      }
    }
  }

  const core = { warning: vi.fn(), info: vi.fn() }
  const context = {
    repo: { owner: 'Comfy-Org', repo: 'ComfyUI_frontend' },
    serverUrl: 'https://github.com',
    runId: 33872270128
  }

  const run = (env: Record<string, string>) =>
    new Function(
      'github',
      'context',
      'core',
      'process',
      'require',
      `"use strict"; return (async () => {\n${actionScript}\n})()`
    )(github, context, core, { env }, require)

  return { run, comments, createComment, updateComment, core }
}

const baseEnv = {
  INPUT_PR_NUMBER: '15740',
  INPUT_COMMENT_MARKER: COMMENT_MARKER
}

describe('upsert-comment-section comment size limit', () => {
  it('clamps an oversized section on create', async () => {
    const harness = createHarness({})

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: 'x'.repeat(244_310)
    })

    const [{ body }] = harness.createComment.mock.calls.map((call) => call[0])
    expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH)
    expect(body).toContain('<!-- section:ci-metrics:start -->')
    expect(body).toContain('<!-- section:ci-metrics:end -->')
    expect(body).toContain('Truncated')
  })

  it('repairs an already-oversized comment and keeps every section addressable', async () => {
    // Reproduces comment 5385418044 on PR #15740: a 244k ci-metrics section
    // alongside a small playwright section, which no longer accepts any write.
    const harness = createHarness({
      comments: [
        {
          id: 5385418044,
          user: { login: 'github-actions[bot]' },
          body: [
            COMMENT_MARKER,
            section('playwright', '✅ 1908 passed, 0 failed'),
            section('ci-metrics', 'y'.repeat(244_310))
          ].join('\n')
        }
      ]
    })

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: 'z'.repeat(200_000)
    })

    expect(harness.updateComment).toHaveBeenCalledTimes(1)
    const { body } = harness.updateComment.mock.calls[0][0]
    expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH)

    // The small section keeps its full content; only the runaway one is cut.
    expect(body).toContain('✅ 1908 passed, 0 failed')
    for (const name of ['playwright', 'ci-metrics']) {
      expect(body).toContain(`<!-- section:${name}:start -->`)
      expect(body).toContain(`<!-- section:${name}:end -->`)
    }
  })

  it('leaves a section that already fits completely untouched', async () => {
    const harness = createHarness({
      comments: [
        {
          id: 1,
          user: { login: 'github-actions[bot]' },
          body: `${COMMENT_MARKER}\n${section('playwright', 'old')}`
        }
      ]
    })

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'playwright',
      INPUT_SECTION_CONTENT: '✅ 1908 passed, 0 failed'
    })

    const { body } = harness.updateComment.mock.calls[0][0]
    expect(body).toContain(section('playwright', '✅ 1908 passed, 0 failed'))
    expect(body).not.toContain('Truncated')
  })

  it('does not retry a 422, which fails identically every attempt', async () => {
    const harness = createHarness({
      comments: [
        {
          id: 1,
          user: { login: 'github-actions[bot]' },
          body: `${COMMENT_MARKER}\n${section('ci-metrics', 'old')}`
        }
      ],
      updateRejection: { status: 422 }
    })

    await expect(
      harness.run({
        ...baseEnv,
        INPUT_SECTION_NAME: 'ci-metrics',
        INPUT_SECTION_CONTENT: 'new'
      })
    ).rejects.toMatchObject({ status: 422 })

    expect(harness.updateComment).toHaveBeenCalledTimes(1)
  })
})
