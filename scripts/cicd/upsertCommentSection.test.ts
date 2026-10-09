import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const marker = '<!-- COMFYUI_FRONTEND_PR_REPORT -->'

const actionSchema = z.object({
  runs: z.object({
    steps: z.tuple([z.object({ with: z.object({ script: z.string() }) })])
  })
})

const script = actionSchema.parse(
  parse(
    readFileSync(
      join(
        import.meta.dirname,
        '../../.github/actions/upsert-comment-section/action.yaml'
      ),
      'utf8'
    )
  )
).runs.steps[0].with.script

interface Comment {
  id: number
  body: string
  user: { login: string }
}

function fakeGithub(initialBodies: string[]) {
  const comments: Comment[] = initialBodies.map((body, index) => ({
    id: index + 1,
    body,
    user: { login: 'github-actions[bot]' }
  }))
  const byId = (id: number) => {
    const comment = comments.find((c) => c.id === id)
    if (!comment) throw new Error(`No comment ${id}`)
    return comment
  }
  const issues = {
    listComments: async () => ({ data: comments.map((c) => ({ ...c })) }),
    createComment: async ({ body }: { body: string }) => {
      comments.push({
        id: comments.length + 1,
        body,
        user: { login: 'github-actions[bot]' }
      })
      return { data: {} }
    },
    updateComment: async ({
      comment_id,
      body
    }: {
      comment_id: number
      body: string
    }) => {
      byId(comment_id).body = body
      return { data: {} }
    },
    getComment: async ({ comment_id }: { comment_id: number }) => ({
      data: { ...byId(comment_id) }
    }),
    deleteComment: async ({ comment_id }: { comment_id: number }) => {
      comments.splice(comments.indexOf(byId(comment_id)), 1)
      return { data: {} }
    }
  }
  return {
    rest: { issues },
    paginate: async <P, R>(
      fn: (params: P) => Promise<{ data: R }>,
      params: P
    ) => (await fn(params)).data,
    comments
  }
}

type Github = ReturnType<typeof fakeGithub>

type UpsertScript = (
  github: Github,
  context: { repo: { owner: string; repo: string } },
  core: { warning: (message: string) => void },
  require: NodeJS.Require
) => Promise<void>

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...params: string[]
) => UpsertScript

const runScript = new AsyncFunction(
  'github',
  'context',
  'core',
  'require',
  script
)

async function upsert(github: Github, name: string, content: string) {
  vi.stubEnv('INPUT_PR_NUMBER', '7')
  vi.stubEnv('INPUT_SECTION_NAME', name)
  vi.stubEnv('INPUT_SECTION_CONTENT', content)
  vi.stubEnv('INPUT_SECTION_CONTENT_FILE', '')
  vi.stubEnv('INPUT_COMMENT_MARKER', marker)
  await runScript(
    github,
    { repo: { owner: 'comfy', repo: 'frontend' } },
    { warning: vi.fn() },
    createRequire(import.meta.url)
  )
}

const block = (name: string, content: string) =>
  `<!-- section:${name}:start -->\n${content}\n<!-- section:${name}:end -->`

const sectionNames = (body: string) =>
  Array.from(body.matchAll(/<!-- section:([a-z0-9-]+):start -->/g), (m) => m[1])

describe('upsert-comment-section ordering', () => {
  it.for<{
    name: string
    existing: string[]
    upserts: [string, string][]
    order: string[]
  }>([
    {
      name: 'ranks sections whichever finished first',
      existing: [],
      upserts: [
        ['preview', 'Preview'],
        ['playwright', 'Playwright'],
        ['fallow', 'Fallow'],
        ['ci-metrics', 'Metrics']
      ],
      order: ['ci-metrics', 'playwright', 'fallow', 'preview']
    },
    {
      name: 'places unlisted sections after the ranked ones, alphabetically',
      existing: [],
      upserts: [
        ['zeta', 'Z'],
        ['preview', 'Preview'],
        ['alpha', 'A']
      ],
      order: ['preview', 'alpha', 'zeta']
    },
    {
      name: 'reorders a report that was written in arrival order',
      existing: [
        `${marker}\n${block('preview', 'Preview')}\n\n${block('playwright', 'Playwright')}`
      ],
      upserts: [['storybook', 'Storybook']],
      order: ['playwright', 'storybook', 'preview']
    }
  ])('$name', async ({ existing, upserts, order }) => {
    const github = fakeGithub(existing)

    for (const [name, content] of upserts) await upsert(github, name, content)

    expect(github.comments).toHaveLength(1)
    const body = github.comments[0].body
    expect(body.startsWith(marker)).toBe(true)
    expect(sectionNames(body)).toEqual(order)
  })

  it('replaces a section in place and keeps the others', async () => {
    const github = fakeGithub([])
    await upsert(github, 'playwright', 'first run')
    await upsert(github, 'storybook', 'Storybook')

    await upsert(github, 'playwright', 'second run')

    const body = github.comments[0].body
    expect(body).toContain(block('playwright', 'second run'))
    expect(body).not.toContain('first run')
    expect(body).toContain(block('storybook', 'Storybook'))
    expect(sectionNames(body)).toEqual(['playwright', 'storybook'])
  })
})
