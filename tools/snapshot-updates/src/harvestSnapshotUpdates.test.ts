import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

import { workflowStepRun } from './workflowStepRun'

const FAKE_GH = `#!/usr/bin/env bash
[ "$1" = run ] && exit 0
while [ $# -gt 0 ]; do
  case "$1" in
    --jq) filter=$2; shift 2 ;;
    */workflows/*) fixture=runs.json; shift ;;
    */jobs*) fixture=jobs.json; shift ;;
    */artifacts*) fixture=artifacts.json; shift ;;
    *) shift ;;
  esac
done
jq -rc "$filter" "$FIXTURES/$fixture"
`

const RUN_URL = 'https://github.com/o/r/actions/runs/900'
const UPLOAD = [{ name: 'Run tests' }, { name: 'Upload snapshot updates' }]

interface Job {
  id: number
  name: string
  conclusion: string | null
  steps: { name: string }[]
}

function harvest(jobs: Job[], artifacts: { name: string; expired: boolean }[]) {
  const root = mkdtempSync(join(tmpdir(), 'harvest-snapshot-updates-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'gh'), FAKE_GH)
  chmodSync(join(root, 'gh'), 0o755)
  writeFileSync(
    join(root, 'runs.json'),
    JSON.stringify({ workflow_runs: [{ id: 900, conclusion: 'failure' }] })
  )
  writeFileSync(join(root, 'jobs.json'), JSON.stringify({ jobs }))
  writeFileSync(join(root, 'artifacts.json'), JSON.stringify({ artifacts }))
  const output = join(root, 'output')
  writeFileSync(output, '')

  const result = spawnSync(
    'bash',
    [
      '-c',
      workflowStepRun(
        'snapshot-update-plan.yaml',
        'harvest',
        "Find the E2E run's snapshot updates"
      )
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        FIXTURES: root,
        GITHUB_OUTPUT: output,
        GITHUB_REPOSITORY: 'o/r',
        GITHUB_SERVER_URL: 'https://github.com',
        E2E_WORKFLOW: 'ci-tests-e2e.yaml',
        HEAD_SHA: 'abc',
        BRANCH: 'feature',
        ARTIFACT_PREFIX: 'snapshot-updates-',
        JOB_PREFIX: 'playwright-tests'
      }
    }
  )
  expect(result.status).toBe(0)
  return Object.fromEntries(
    readFileSync(output, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(/=(.*)/s).slice(0, 2))
  )
}

describe('harvesting snapshot updates from an E2E run', () => {
  it('ignores Playwright jobs that upload no snapshot updates', () => {
    expect(
      harvest(
        [
          {
            id: 101,
            name: 'playwright-tests-chromium-sharded (1, 2)',
            conclusion: 'failure',
            steps: UPLOAD
          },
          {
            id: 102,
            name: 'playwright-tests-native-lora',
            conclusion: 'success',
            steps: [{ name: 'Run native LoRA asset and execution tests' }]
          }
        ],
        [{ name: 'snapshot-updates-chromium-1-101', expired: false }]
      )
    ).toEqual({ 'run-id': '900' })
  })

  it('commits the artifacts that exist and names the ran jobs that left none', () => {
    expect(
      harvest(
        [
          {
            id: 123,
            name: 'playwright-tests-chromium-sharded (1, 2)',
            conclusion: 'failure',
            steps: UPLOAD
          },
          {
            id: 23,
            name: 'playwright-tests-chromium-sharded (2, 2)',
            conclusion: 'success',
            steps: UPLOAD
          },
          {
            id: 7,
            name: 'playwright-tests (desktop, frontend-dist-desktop)',
            conclusion: 'failure',
            steps: []
          },
          {
            id: 8,
            name: 'playwright-tests (mobile-chrome, frontend-dist)',
            conclusion: 'skipped',
            steps: UPLOAD
          }
        ],
        [
          { name: 'snapshot-updates-chromium-1-123', expired: false },
          { name: 'snapshot-updates-chromium-2-23', expired: true }
        ]
      )
    ).toEqual({
      'run-id': '900',
      missing:
        'playwright-tests-chromium-sharded (2, 2), playwright-tests (desktop, frontend-dist-desktop)'
    })
  })

  it.for([
    {
      reason: 'no job left an artifact',
      conclusion: 'failure',
      expected: `None of the 1 playwright-tests jobs in ${RUN_URL} left a usable snapshot-updates-* artifact.`
    },
    {
      reason: 'a job did not finish',
      conclusion: 'cancelled',
      expected: `Some playwright-tests jobs in ${RUN_URL} did not finish.`
    }
  ])('refuses the run when $reason', ({ conclusion, expected }) => {
    expect(
      harvest(
        [
          {
            id: 101,
            name: 'playwright-tests-chromium-sharded (1, 2)',
            conclusion,
            steps: UPLOAD
          }
        ],
        []
      )
    ).toEqual({ unavailable: expected })
  })
})
