import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Workflow {
  jobs?: Record<string, { steps?: Array<{ run?: string }> }>
}

const workflow = parse(
  readFileSync('.github/workflows/pr-backport.yaml', 'utf8')
) as Workflow
const warnScript =
  workflow.jobs?.['warn-missing-needs-backport']?.steps?.[0]?.run ?? ''

const fakeGh = `#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *" --method POST "* ]]; then
  for arg in "$@"; do
    if [[ "$arg" == body=* ]]; then
      printf '%s\\n' "\${arg#body=}" >> "$FAKE_COMMENTS"
      echo posted >> "$FAKE_POSTS"
    fi
  done
else
  cat "$FAKE_COMMENTS" 2>/dev/null || true
fi
`

function createPr(labels: string[]) {
  const directory = mkdtempSync(join(tmpdir(), 'backport-missing-trigger-'))
  const event = join(directory, 'event.json')
  const comments = join(directory, 'comments')
  const posts = join(directory, 'posts')
  writeFileSync(join(directory, 'gh'), fakeGh)
  chmodSync(join(directory, 'gh'), 0o755)
  writeFileSync(
    event,
    JSON.stringify({
      pull_request: { labels: labels.map((name) => ({ name })) }
    })
  )

  return {
    runWarning: () =>
      spawnSync('bash', ['-c', warnScript], {
        encoding: 'utf8',
        env: {
          ...process.env,
          FAKE_COMMENTS: comments,
          FAKE_POSTS: posts,
          GH_REPO: 'Comfy-Org/ComfyUI_frontend',
          GITHUB_EVENT_PATH: event,
          PATH: `${directory}:${process.env.PATH}`,
          PR_NUMBER: '21241'
        }
      }),
    postCount: () =>
      existsSync(posts)
        ? readFileSync(posts, 'utf8').trim().split('\n').length
        : 0,
    comments: () => (existsSync(comments) ? readFileSync(comments, 'utf8') : '')
  }
}

describe('backport warning for release labels without needs-backport', () => {
  it('posts one comment naming the release labels and how to start the backport', () => {
    const pr = createPr(['core/1.57', 'cloud/1.57', 'bug'])

    const result = pr.runWarning()

    expect(result.status).toBe(0)
    expect(pr.postCount()).toBe(1)
    expect(pr.comments()).toContain('`core/1.57` `cloud/1.57`')
    expect(pr.comments()).toContain('add the `needs-backport` label')
    expect(pr.comments()).not.toContain('`bug`')
  })

  it('does not post again when the workflow re-runs on a later label event', () => {
    const pr = createPr(['core/1.57'])

    pr.runWarning()
    const rerun = pr.runWarning()

    expect(rerun.status).toBe(0)
    expect(pr.postCount()).toBe(1)
  })

  it.for([[['bug']], [['1.57', 'branch:release/hotfix']], [['core/1.57-rc']]])(
    'stays silent without a core/X.Y or cloud/X.Y label: %j',
    ([labels]) => {
      const pr = createPr(labels)

      const result = pr.runWarning()

      expect(result.status).toBe(0)
      expect(pr.postCount()).toBe(0)
    }
  )
})
