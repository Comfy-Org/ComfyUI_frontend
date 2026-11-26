import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflow = z
  .object({
    jobs: z.object({
      close: z.object({
        steps: z.array(z.object({ with: z.object({ script: z.string() }) }))
      })
    })
  })
  .parse(
    parse(readFileSync('.github/workflows/pr-close-retired-cloud.yaml', 'utf8'))
  )

it.for([
  { base: 'cloud/1.31', state: 'open', closes: true },
  { base: 'cloud/1.49', state: 'open', closes: true },
  { base: 'cloud/1.60', state: 'open', closes: true },
  { base: 'cloud/1.30', state: 'open', closes: false },
  { base: 'cloud/1.61', state: 'open', closes: false },
  { base: 'cloud/model-selection-primitive', state: 'open', closes: false },
  { base: 'backport-12543-cloud/1.44', state: 'open', closes: false },
  { base: 'core/1.60', state: 'open', closes: false },
  { base: 'main', state: 'open', closes: false },
  { base: 'cloud/1.60', state: 'closed', closes: false }
])('closes=$closes for live $state PR targeting $base', async (scenario) => {
  const update = vi.fn()
  const github = {
    rest: {
      pulls: {
        get: async () => ({
          data: { state: scenario.state, base: { ref: scenario.base } }
        }),
        update
      }
    }
  }

  await runInNewContext(
    `(async () => {${workflow.jobs.close.steps[0].with.script}})()`,
    {
      github,
      context: {
        repo: { owner: 'Comfy-Org', repo: 'ComfyUI_frontend' },
        issue: { number: 123 },
        payload: { pull_request: { base: { ref: 'cloud/1.60' } } }
      }
    }
  )

  expect(update.mock.calls).toEqual(
    scenario.closes
      ? [
          [
            {
              owner: 'Comfy-Org',
              repo: 'ComfyUI_frontend',
              pull_number: 123,
              state: 'closed'
            }
          ]
        ]
      : []
  )
})
