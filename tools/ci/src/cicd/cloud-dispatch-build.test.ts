import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflow = z
  .object({
    jobs: z.object({
      dispatch: z.object({
        steps: z.array(z.object({ run: z.string().optional() }))
      })
    })
  })
  .parse(
    parse(readFileSync('.github/workflows/cloud-dispatch-build.yaml', 'utf8'))
  )
const script = workflow.jobs.dispatch.steps.find((step) => step.run)?.run
if (!script) throw new Error('Missing dispatch payload step')

describe('cloud build dispatch payload', () => {
  it.for([
    {
      branch: 'main',
      labels: [],
      expected: {
        should_dispatch: true,
        json: {
          ref: 'abc123',
          branch: 'main',
          pr_number: '',
          variant: '',
          asset_cache_bust: 'cache-salt'
        }
      }
    },
    { branch: 'cloud/1.59', labels: [], expected: { should_dispatch: false } },
    { branch: 'feature/fix', labels: [], expected: { should_dispatch: false } },
    {
      branch: 'feature/fix',
      labels: ['preview'],
      expected: {
        should_dispatch: true,
        json: {
          ref: 'abc123',
          branch: 'feature/fix',
          pr_number: '42',
          variant: 'cpu',
          asset_cache_bust: 'cache-salt'
        }
      }
    },
    {
      branch: 'feature/fix',
      labels: ['preview-cpu', 'preview-gpu'],
      expected: {
        should_dispatch: true,
        json: {
          ref: 'abc123',
          branch: 'feature/fix',
          pr_number: '42',
          variant: 'gpu',
          asset_cache_bust: 'cache-salt'
        }
      }
    }
  ])('routes a push to $branch with $labels', (scenario) => {
    const directory = mkdtempSync(join(tmpdir(), 'cloud-dispatch-'))
    onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
    const output = join(directory, 'output')
    writeFileSync(output, '')
    writeFileSync(
      join(directory, 'gh'),
      '#!/bin/sh\nprintf "%s" "$FAKE_PRS"\n',
      { mode: 0o755 }
    )

    const result = spawnSync('bash', ['--noprofile', '--norc', '-c', script], {
      encoding: 'utf8',
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        EVENT_NAME: 'push',
        GITHUB_SHA: 'abc123',
        GITHUB_REF_NAME: scenario.branch,
        GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
        GITHUB_OUTPUT: output,
        ASSET_CACHE_BUST: 'cache-salt',
        FAKE_PRS: JSON.stringify([
          { number: 42, labels: scenario.labels.map((name) => ({ name })) }
        ])
      }
    })

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    const outputs = Object.fromEntries(
      readFileSync(output, 'utf8')
        .trim()
        .split('\n')
        .map((line) => {
          const separator = line.indexOf('=')
          return [
            line.slice(0, separator),
            JSON.parse(line.slice(separator + 1))
          ]
        })
    )
    expect(outputs).toEqual(scenario.expected)
  })
})
