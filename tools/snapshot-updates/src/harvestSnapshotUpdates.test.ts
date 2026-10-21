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

import { assert, describe, expect, it, onTestFinished } from 'vitest'

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

function shard(id: number, conclusion: string, steps = UPLOAD): Job {
  return { id, name: `playwright-tests shard ${id}`, conclusion, steps }
}

function artifact(id: number, expired = false) {
  return { name: `snapshot-updates-shard-${id}`, expired }
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

  const script = workflowStepRun(
    'snapshot-update-plan.yaml',
    'harvest',
    "Find the E2E run's snapshot updates"
  )
  assert.exists(script)

  const result = spawnSync('bash', ['-c', script], {
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
  })
  expect(result.status).toBe(0)
  return Object.fromEntries(
    readFileSync(output, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(/=(.*)/s).slice(0, 2))
  )
}

describe('harvesting snapshot updates from an E2E run', () => {
  it.for([
    {
      when: 'every screenshot job left an artifact',
      jobs: [
        shard(101, 'failure'),
        {
          id: 102,
          name: 'playwright-tests-native-lora',
          conclusion: 'success',
          steps: [{ name: 'Run native LoRA asset and execution tests' }]
        }
      ],
      artifacts: [artifact(101)],
      outputs: { 'run-id': '900' }
    },
    {
      when: 'some ran jobs left no usable artifact',
      jobs: [
        shard(123, 'failure'),
        shard(23, 'success'),
        shard(7, 'failure', []),
        shard(8, 'skipped')
      ],
      artifacts: [artifact(123), artifact(23, true)],
      outputs: {
        'run-id': '900',
        missing: 'playwright-tests shard 23, playwright-tests shard 7'
      }
    },
    {
      when: 'no job left an artifact',
      jobs: [shard(101, 'failure')],
      artifacts: [],
      outputs: {
        unavailable: `None of the 1 playwright-tests jobs in ${RUN_URL} left a usable snapshot-updates-* artifact.`
      }
    },
    {
      when: 'a job did not finish',
      jobs: [shard(101, 'cancelled')],
      artifacts: [artifact(101)],
      outputs: {
        unavailable: `Some playwright-tests jobs in ${RUN_URL} did not finish.`
      }
    },
    {
      when: 'every job was skipped',
      jobs: [shard(101, 'skipped')],
      artifacts: [],
      outputs: { unavailable: `No playwright-tests jobs ran in ${RUN_URL}.` }
    }
  ])('harvests a run where $when', ({ jobs, artifacts, outputs }) => {
    expect(harvest(jobs, artifacts)).toEqual(outputs)
  })
})
