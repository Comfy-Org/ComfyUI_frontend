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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflowSchema = z.object({
  jobs: z.object({
    backport: z.object({
      steps: z.array(
        z.object({ name: z.string().optional(), run: z.string().optional() })
      )
    })
  })
})

const PR_NUMBER = '21829'

function validateScript() {
  const workflow = workflowSchema.parse(
    parse(readFileSync('.github/workflows/pr-backport.yaml', 'utf8'))
  )
  const step = workflow.jobs.backport.steps.find(
    (step) => step.name === 'Validate inputs for manual triggers'
  )
  if (!step?.run) throw new Error('Missing manual trigger validation')
  return step.run.replaceAll('${{ inputs.pr_number }}', PR_NUMBER)
}

const GH_STUB = `#!/usr/bin/env bash
filter="." fields=""
while [ $# -gt 0 ]; do
  case "$1" in
    --json) fields="$2"; shift 2 ;;
    --jq) filter="$2"; shift 2 ;;
    *) shift ;;
  esac
done
jq -c --arg state "$STUB_STATE" --argjson labels "$STUB_LABELS" -n '
  {state: $state, labels: ($labels | map({name: .}))}' \
  | jq -r "$filter"
`

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pr-backport-dispatch-'))
  writeFileSync(join(dir, 'gh'), GH_STUB)
  chmodSync(join(dir, 'gh'), 0o755)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function runValidate(state: string, labels: string[]) {
  return spawnSync('bash', ['--noprofile', '--norc', '-c', validateScript()], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      STUB_STATE: state,
      STUB_LABELS: JSON.stringify(labels)
    },
    encoding: 'utf8'
  })
}

describe('pr-backport manual dispatch validation', () => {
  it('accepts a merged PR whose needs-backport label the bot already removed', () => {
    const result = runValidate('MERGED', ['core/1.57', 'cloud/1.57'])

    expect(result.stdout).not.toContain('::error::')
    expect(result.status).toBe(0)
  })

  it('accepts a merged PR that still has needs-backport', () => {
    expect(runValidate('MERGED', ['needs-backport', 'core/1.57']).status).toBe(
      0
    )
  })

  it('rejects a PR that has not merged', () => {
    const result = runValidate('OPEN', ['needs-backport', 'core/1.57'])

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('is not merged')
  })

  it.for([
    {
      labels: ['core/1.57', 'cloud/1.57'],
      status: 0,
      targets: 'targets=core/1.57\n'
    },
    { labels: ['cloud/1.57'], status: 1, targets: '' },
    { labels: ['core/1.56'], status: 1, targets: '' },
    { labels: ['branch:core/1.56'], status: 1, targets: '' },
    { labels: ['backport:core/1.56'], status: 1, targets: '' },
    { labels: ['branch:cloud/1.57'], status: 1, targets: '' },
    { labels: ['branch:main'], status: 1, targets: '' },
    {
      labels: ['1.57', 'branch:core/1.58', 'backport:core/1.58', 'core/1.57'],
      status: 0,
      targets: 'targets=core/1.57 core/1.58\n'
    }
  ])(
    'collects only supported targets from $labels',
    ({ labels, status, targets }) => {
      const workflow = workflowSchema.parse(
        parse(readFileSync('.github/workflows/pr-backport.yaml', 'utf8'))
      )
      const step = workflow.jobs.backport.steps.find(
        (step) => step.name === 'Collect backport targets'
      )
      if (!step?.run) throw new Error('Missing backport target collection')
      const script = step.run
        .replaceAll('${{ github.event_name }}', 'workflow_dispatch')
        .replaceAll('${{ inputs.pr_number }}', PR_NUMBER)
      const output = join(dir, 'output')
      writeFileSync(output, '')

      const result = spawnSync(
        'bash',
        ['--noprofile', '--norc', '-c', script],
        {
          env: {
            PATH: `${dir}:${process.env.PATH}`,
            ACTIVE_CORE_TARGETS: 'core/1.57 core/1.58',
            STUB_STATE: 'MERGED',
            STUB_LABELS: JSON.stringify(labels),
            GITHUB_OUTPUT: output
          },
          encoding: 'utf8'
        }
      )

      expect(result.stderr).toBe('')
      expect(result.status).toBe(status)
      expect(readFileSync(output, 'utf8')).toBe(targets)
    }
  )
})
