import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflow = z
  .object({
    permissions: z.record(z.string(), z.string()),
    jobs: z.object({
      close: z.object({
        steps: z.array(
          z.object({
            uses: z.string(),
            with: z
              .object({
                ref: z.string().optional(),
                'persist-credentials': z.boolean().optional(),
                script: z.string().optional()
              })
              .optional()
          })
        )
      })
    })
  })
  .parse(
    parse(readFileSync('.github/workflows/pr-close-retired-core.yaml', 'utf8'))
  )

async function guard({
  pr = { state: 'open', base: { ref: 'core/1.58' } },
  pin = 'pin-sha',
  pinLookupBase = pr.base.ref
}: {
  pr?: { state: string; base: { ref: string } }
  pin?: string
  pinLookupBase?: string
} = {}) {
  const script = workflow.jobs.close.steps.find((step) => step.with?.script)
    ?.with?.script
  expect(script).toBeDefined()
  await runInNewContext(`(async () => {${script}})()`, {
    github: {
      rest: {
        pulls: {
          get: async () => ({ data: { ...pr, base: { ...pr.base } } }),
          update: async ({ state }: { state: string }) => {
            pr.state = state
          }
        },
        git: {
          getRef: async () => {
            pr.base.ref = pinLookupBase
            return { data: { object: { sha: pin } } }
          }
        }
      }
    },
    context: {
      repo: { owner: 'Comfy-Org', repo: 'ComfyUI_frontend' },
      issue: { number: 123 },
      payload: { pull_request: { base: { ref: 'core/1.58' } } }
    },
    process: {
      env: {
        RETIRED_CORE_TARGETS: 'core/1.9 core/1.58',
        COMFYUI_PIN_SHA: 'pin-sha'
      }
    }
  })
  return pr.state
}

it.for([
  { base: 'core/1.9', expected: 'closed' },
  { base: 'core/1.58', expected: 'closed' },
  { base: 'core/1.59', expected: 'open' },
  { base: 'core/1.60', expected: 'open' },
  { base: 'core/1.580', expected: 'open' },
  { base: 'core/feature', expected: 'open' },
  { base: 'cloud/1.58', expected: 'open' },
  { base: 'main', expected: 'open' }
])('leaves live target $base $expected', async ({ base, expected }) => {
  const pr = { state: 'open', base: { ref: base } }
  expect(await guard({ pr })).toBe(expected)
})

it('leaves an already closed PR closed', async () => {
  const pr = { state: 'closed', base: { ref: 'core/1.58' } }
  expect(await guard({ pr })).toBe('closed')
})

it('leaves a PR open when retargeted to an active line during the pin lookup', async () => {
  expect(await guard({ pinLookupBase: 'core/1.59' })).toBe('open')
})

it('aborts closure when the consumer pin changes', async () => {
  const pr = { state: 'open', base: { ref: 'core/1.58' } }
  await expect(guard({ pin: 'changed-pin', pr })).rejects.toThrow(
    'ComfyUI changed'
  )
  expect(pr.state).toBe('open')
})

it('executes only trusted policy without persisting checkout credentials', () => {
  expect(workflow.permissions).toEqual({
    contents: 'read',
    'pull-requests': 'write'
  })
  expect(
    workflow.jobs.close.steps.filter((step) =>
      step.uses.startsWith('actions/checkout@')
    )
  ).toEqual([
    expect.objectContaining({
      with: { ref: 'main', 'persist-credentials': false }
    })
  ])
})
