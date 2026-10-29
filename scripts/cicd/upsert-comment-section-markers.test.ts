import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'

const ROOT = join(import.meta.dirname, '../..')
const COMMENT_MARKER = '<!-- COMFYUI_FRONTEND_PR_REPORT -->'

const script = parseDocument(
  readFileSync(
    join(ROOT, '.github/actions/upsert-comment-section/action.yaml'),
    'utf8'
  )
).getIn(['runs', 'steps', 0, 'with', 'script'])

type Comment = { id: number; body: string; user: { login: string } }

const AsyncFunction: new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void> = Object.getPrototypeOf(
  async () => {}
).constructor

function fakeGitHub() {
  const comments: Comment[] = []
  const byId = (id: number) => {
    const comment = comments.find((c) => c.id === id)
    if (!comment) throw new Error(`No comment ${id}`)
    return comment
  }
  const rest = {
    issues: {
      listComments: () => {},
      createComment: async ({ body }: { body: string }) => {
        comments.push({
          id: comments.length + 1,
          body,
          user: { login: 'github-actions[bot]' }
        })
      },
      updateComment: async ({
        comment_id,
        body
      }: {
        comment_id: number
        body: string
      }) => {
        byId(comment_id).body = body
      },
      getComment: async ({ comment_id }: { comment_id: number }) => ({
        data: byId(comment_id)
      }),
      deleteComment: async () => {}
    }
  }
  return {
    comments,
    github: { rest, paginate: async () => comments.map((c) => ({ ...c })) }
  }
}

async function upsert(
  github: ReturnType<typeof fakeGitHub>['github'],
  sectionName: string,
  sectionContent: string,
  commentMarker = COMMENT_MARKER
) {
  await new AsyncFunction(
    'github',
    'context',
    'core',
    'require',
    'process',
    String(script)
  )(
    github,
    { repo: { owner: 'owner', repo: 'repo' } },
    { warning: () => {} },
    () => {},
    {
      env: {
        INPUT_PR_NUMBER: '1',
        INPUT_SECTION_NAME: sectionName,
        INPUT_SECTION_CONTENT: sectionContent,
        INPUT_SECTION_CONTENT_FILE: '',
        INPUT_COMMENT_MARKER: commentMarker
      }
    }
  )
}

const sectionNamesIn = (body: string) =>
  Array.from(body.matchAll(/<!-- section:([a-z0-9-]+):start -->/g), (m) => m[1])

const sectionContentsIn = (body: string) =>
  Object.fromEntries(
    Array.from(
      body.matchAll(
        /<!-- section:([a-z0-9-]+):start -->\n([\s\S]*?)\n<!-- section:\1:end -->/g
      ),
      (m) => [m[1], m[2]]
    )
  )

describe('upsert-comment-section content containing section markers', () => {
  it('leaves only the upserted section and replaces it whole', async () => {
    const { comments, github } = fakeGitHub()

    await upsert(github, 'a', '<!-- section:b:start -->x<!-- section:b:end -->')
    expect(sectionNamesIn(comments[0].body)).toEqual(['a'])

    await upsert(github, 'a', 'replaced')
    expect(comments).toHaveLength(1)
    expect(comments[0].body).toBe(
      `${COMMENT_MARKER}\n\n<!-- section:a:start -->\nreplaced\n<!-- section:a:end -->`
    )
  })

  it('cannot truncate itself or overwrite another section', async () => {
    const { comments, github } = fakeGitHub()
    const forged =
      'kept <!-- section:z:end --> <!-- section:b:start -->fake<!-- section:b:end --> kept'

    await upsert(github, 'b', 'real b')
    await upsert(github, 'z', forged)
    await upsert(github, 'c', 'other')

    expect(sectionContentsIn(comments[0].body)).toEqual({
      b: 'real b',
      c: 'other',
      z: 'kept <!--\u200B section:z:end --> <!--\u200B section:b:start -->fake<!--\u200B section:b:end --> kept'
    })
  })

  it('cannot be matched as another report comment', async () => {
    const { comments, github } = fakeGitHub()
    const videoMarker = '<!-- playwright-video-new-tests -->'

    await upsert(
      github,
      'a',
      `${videoMarker} <!-- PLAYWRIGHT_TEST_STATUS --> <!-- unrelated-report -->`
    )
    await upsert(github, 'videos', 'video report', videoMarker)

    expect(comments).toHaveLength(2)
    expect(comments[0].body).toBe(
      `${COMMENT_MARKER}\n\n<!-- section:a:start -->\n<!--\u200B playwright-video-new-tests --> <!--\u200B PLAYWRIGHT_TEST_STATUS --> <!--\u200B unrelated-report -->\n<!-- section:a:end -->`
    )
  })

  it('escapes markers read through the file input', async () => {
    const { comments, github } = fakeGitHub()

    await new AsyncFunction(
      'github',
      'context',
      'core',
      'require',
      'process',
      String(script)
    )(
      github,
      { repo: { owner: 'owner', repo: 'repo' } },
      { warning: () => {} },
      () => ({
        readFileSync: () => '<!-- section:b:start -->file<!-- section:b:end -->'
      }),
      {
        env: {
          INPUT_PR_NUMBER: '1',
          INPUT_SECTION_NAME: 'a',
          INPUT_SECTION_CONTENT: '',
          INPUT_SECTION_CONTENT_FILE: 'report.md',
          INPUT_COMMENT_MARKER: COMMENT_MARKER
        }
      }
    )

    expect(comments[0].body).toBe(
      `${COMMENT_MARKER}\n\n<!-- section:a:start -->\n<!--\u200B section:b:start -->file<!--\u200B section:b:end -->\n<!-- section:a:end -->`
    )
  })
})
