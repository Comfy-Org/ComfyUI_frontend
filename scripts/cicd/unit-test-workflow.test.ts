import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { z } from 'zod'

const workflow = parseDocument(
  readFileSync('.github/workflows/ci-tests-unit.yaml', 'utf8')
)
const command = z
  .string()
  .parse(workflow.getIn(['jobs', 'test', 'steps', 0, 'run']))

it('runs the required check even when a dependency fails or is skipped', () => {
  expect(workflow.toJS()).toMatchObject({
    jobs: {
      test: {
        if: '${{ always() }}',
        needs: ['changes', 'test-shards', 'test-report']
      }
    }
  })
})

it.for`
  changes        | shouldRun  | shards         | report         | status
  ${'success'}   | ${'true'}  | ${'success'}   | ${'success'}   | ${0}
  ${'success'}   | ${'false'} | ${'skipped'}   | ${'skipped'}   | ${0}
  ${'failure'}   | ${''}      | ${'skipped'}   | ${'skipped'}   | ${1}
  ${'cancelled'} | ${''}      | ${'skipped'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${''}      | ${'skipped'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'failure'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'cancelled'} | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'skipped'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'failure'}   | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'cancelled'} | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'false'} | ${'failure'}   | ${'skipped'}   | ${1}
`(
  'unit check exits $status for changes=$changes, shouldRun=$shouldRun, shards=$shards, report=$report',
  ({ changes, shouldRun, shards, report, status }) => {
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CHANGES: changes,
        SHOULD_RUN: shouldRun,
        SHARDS: shards,
        REPORT: report
      }
    })

    expect(result.status).toBe(status)
  }
)
