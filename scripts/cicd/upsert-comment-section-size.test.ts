import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parse } from 'yaml'
import { describe, expect, it, vi } from 'vitest'

const MAX_COMMENT_LENGTH = 65536

const ACTION_PATH = join(
  import.meta.dirname,
  '../../.github/actions/upsert-comment-section/action.yaml'
)

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
  updateRejections?: number
}) {
  const comments: Comment[] = options.comments ?? []
  let updateRejections = options.updateRejections ?? 0
  const updateComment = vi.fn(
    async ({ comment_id, body }: { comment_id: number; body: string }) => {
      if (updateRejections > 0) {
        updateRejections--
        throw { status: 422 }
      }
      const target = comments.find((c) => c.id === comment_id)
      if (target) target.body = body
      return { data: target }
    }
  )
  const createComment = vi.fn(async ({ body }: { body: string }) => {
    const created = {
      id: Math.max(0, ...comments.map((comment) => comment.id)) + 1,
      user: { login: 'github-actions[bot]' },
      body
    }
    comments.push(created)
    return { data: created }
  })

  const listComments = vi.fn(async () => ({ data: comments }))
  const deleteComment = vi.fn(
    async ({ comment_id }: { comment_id: number }) => {
      const index = comments.findIndex((comment) => comment.id === comment_id)
      if (index !== -1) comments.splice(index, 1)
      return {}
    }
  )
  const github = {
    paginate: async (fn: typeof listComments) => (await fn()).data,
    rest: {
      issues: {
        listComments,
        createComment,
        updateComment,
        deleteComment,
        getComment: vi.fn(async ({ comment_id }: { comment_id: number }) => ({
          data: comments.find((c) => c.id === comment_id)
        }))
      }
    }
  }

  const core = { warning: vi.fn(), info: vi.fn() }
  const context = {
    repo: { owner: 'Comfy-Org', repo: 'ComfyUI_frontend' },
    serverUrl: 'https://github.com'
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

  return {
    run,
    comments,
    createComment,
    updateComment,
    deleteComment,
    core
  }
}

const baseEnv = {
  INPUT_PR_NUMBER: '15740',
  INPUT_COMMENT_MARKER: COMMENT_MARKER
}

function combinedContent(comments: Comment[]) {
  return [...comments]
    .sort((a, b) => {
      const page = (body: string) =>
        Number(body.match(/upsert-comment-section:page:(\d+)/)?.[1] ?? 1)
      return page(a.body) - page(b.body)
    })
    .map((comment) =>
      comment.body.replace(
        /^<!-- COMFYUI_FRONTEND_PR_REPORT -->\n(?:<!-- upsert-comment-section:page:\d+ -->\n)?/,
        ''
      )
    )
    .join('')
}

describe('upsert-comment-section overflow comments', () => {
  it('preserves an oversized section across bounded comments', async () => {
    const harness = createHarness({})
    const content = 'x'.repeat(244_310)

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: content
    })

    expect(harness.comments.length).toBeGreaterThan(1)
    expect(
      harness.comments.every(
        (comment) => comment.body.length <= MAX_COMMENT_LENGTH
      )
    ).toBe(true)
    expect(combinedContent(harness.comments)).toBe(
      section('ci-metrics', content)
    )
  })

  it('does not split a surrogate pair between comments', async () => {
    const harness = createHarness({})
    const pagePrefix = `${COMMENT_MARKER}\n<!-- upsert-comment-section:page:1 -->\n`
    const sectionPrefix = '<!-- section:ci-metrics:start -->\n'
    const firstPageBudget = MAX_COMMENT_LENGTH - pagePrefix.length
    const content =
      'x'.repeat(firstPageBudget - sectionPrefix.length - 1) + '📊' + 'tail'

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: content
    })

    expect(harness.comments).toHaveLength(2)
    expect(harness.comments[0].body.at(-1)).not.toMatch(/[\uD800-\uDBFF]/)
    expect(combinedContent(harness.comments)).toBe(
      section('ci-metrics', content)
    )
  })

  it('migrates an oversized legacy comment without dropping another section', async () => {
    const oldContent = 'y'.repeat(244_310)
    const newContent = 'z'.repeat(200_000)
    const harness = createHarness({
      comments: [
        {
          id: 5385418044,
          user: { login: 'github-actions[bot]' },
          body: [
            COMMENT_MARKER,
            section('playwright', '✅ 1908 passed, 0 failed'),
            section('ci-metrics', oldContent)
          ].join('\n')
        }
      ]
    })

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: newContent
    })

    expect(combinedContent(harness.comments)).toBe(
      [
        section('playwright', '✅ 1908 passed, 0 failed'),
        section('ci-metrics', newContent)
      ].join('\n')
    )
  })

  it('updates marker-like and replacement-token content literally', async () => {
    const content = [
      "$& $` $' $$ $1",
      '<!-- section:playwright:end -->',
      'still part of the report'
    ].join('\n')
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
      INPUT_SECTION_CONTENT: content
    })

    expect(combinedContent(harness.comments)).toBe(
      section('playwright', content)
    )
  })

  it('is idempotent when rerun with the same oversized content', async () => {
    const harness = createHarness({})
    const env = {
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: 'x'.repeat(140_000)
    }

    await harness.run(env)
    const afterFirstRun = structuredClone(harness.comments)
    const createCalls = harness.createComment.mock.calls.length
    const updateCalls = harness.updateComment.mock.calls.length

    await harness.run(env)

    expect(harness.comments).toEqual(afterFirstRun)
    expect(harness.createComment).toHaveBeenCalledTimes(createCalls)
    expect(harness.updateComment).toHaveBeenCalledTimes(updateCalls)
    expect(harness.deleteComment).not.toHaveBeenCalled()
  })

  it('removes stale overflow comments when content shrinks', async () => {
    const harness = createHarness({})
    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: 'x'.repeat(140_000)
    })
    expect(harness.comments.length).toBeGreaterThan(1)

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: 'small'
    })

    expect(harness.comments).toHaveLength(1)
    expect(combinedContent(harness.comments)).toBe(
      section('ci-metrics', 'small')
    )
  })

  it('merges duplicate comments before deleting them', async () => {
    const harness = createHarness({
      comments: [
        {
          id: 1,
          user: { login: 'github-actions[bot]' },
          body: `${COMMENT_MARKER}\n${section('playwright', 'passed')}`
        },
        {
          id: 2,
          user: { login: 'github-actions[bot]' },
          body: `${COMMENT_MARKER}\n${section('storybook', 'passed')}`
        }
      ]
    })

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: 'passed'
    })

    expect(harness.comments).toHaveLength(1)
    expect(combinedContent(harness.comments)).toContain(
      section('playwright', 'passed')
    )
    expect(combinedContent(harness.comments)).toContain(
      section('storybook', 'passed')
    )
    expect(combinedContent(harness.comments)).toContain(
      section('ci-metrics', 'passed')
    )
    expect(harness.deleteComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 2 })
    )
  })

  it('retries a transient 422 response', async () => {
    const harness = createHarness({
      comments: [
        {
          id: 1,
          user: { login: 'github-actions[bot]' },
          body: `${COMMENT_MARKER}\n${section('ci-metrics', 'old')}`
        }
      ],
      updateRejections: 1
    })

    await harness.run({
      ...baseEnv,
      INPUT_SECTION_NAME: 'ci-metrics',
      INPUT_SECTION_CONTENT: 'new'
    })

    expect(harness.updateComment).toHaveBeenCalledTimes(2)
    expect(combinedContent(harness.comments)).toBe(section('ci-metrics', 'new'))
  })
})
