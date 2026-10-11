import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflow = z
  .object({
    jobs: z.object({
      'check-cut': z.object({
        steps: z.array(z.object({ with: z.object({ script: z.string() }) }))
      })
    })
  })
  .parse(
    parse(readFileSync('.github/workflows/release-version-bump.yaml', 'utf8'))
  )
const script = workflow.jobs['check-cut'].steps[0].with.script

async function checkCut(
  createdAt: string,
  issues: {
    state: string
    body: string
    pull_request?: object
    html_url: string
  }[],
  isCut = true
) {
  const outputs: Record<string, unknown> = {}
  const notices: string[] = []
  const execution: unknown = runInNewContext(`(async () => { ${script} })()`, {
    github: {
      rest: {
        actions: {
          getWorkflowRun: async () => ({ data: { created_at: createdAt } })
        },
        issues: { listForRepo: 'issues' }
      },
      paginate: async () => issues
    },
    context: {
      repo: { owner: 'Comfy-Org', repo: 'ComfyUI_frontend' },
      runId: 42
    },
    core: {
      setOutput: (name: string, value: unknown) => {
        outputs[name] = value
      },
      notice: (message: string) => {
        notices.push(message)
      }
    },
    process: { env: { IS_CUT: String(isCut) } },
    Intl,
    Date
  })
  await execution
  return { outputs, notices }
}

describe('scheduled cut deduplication', () => {
  it.for([
    ['2026-09-22T01:00:00Z', '2026-09-21'],
    ['2026-12-22T01:00:00Z', '2026-12-21']
  ])(
    'uses the original run date in Pacific time: %s',
    async ([timestamp, date]) => {
      expect((await checkCut(timestamp, [])).outputs).toEqual({
        exists: false,
        marker: `<!-- release-cut:${date} -->`
      })
    }
  )
  it('does not cut again when a rerun follows a merged or closed PR', async () => {
    const result = await checkCut('2026-09-21T19:10:00Z', [
      {
        state: 'closed',
        body: '<!-- release-cut:2026-09-21 -->',
        pull_request: {},
        html_url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/1'
      }
    ])
    expect(result.outputs.exists).toBe(true)
    expect(result.notices).toHaveLength(1)
  })
  it('holds Wednesday while Monday still needs approval', async () => {
    expect(
      (
        await checkCut('2026-09-23T19:10:00Z', [
          {
            state: 'open',
            body: '<!-- release-cut:2026-09-21 -->',
            pull_request: {},
            html_url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/1'
          }
        ])
      ).outputs.exists
    ).toBe(true)
  })
  it('allows a new cut after the previous date was resolved', async () => {
    expect(
      (
        await checkCut('2026-09-23T19:10:00Z', [
          {
            state: 'closed',
            body: '<!-- release-cut:2026-09-21 -->',
            pull_request: {},
            html_url: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/1'
          }
        ])
      ).outputs.exists
    ).toBe(false)
  })
  it('leaves nightly and explicit bumps unchanged', async () => {
    expect((await checkCut('2026-09-21T19:10:00Z', [], false)).outputs).toEqual(
      {}
    )
  })
})
