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

// Sharing a group across main pushes is what let one merge cancel the run
// measuring the merge before it, which is the bug this key exists to fix.
it('gives every main push its own concurrency group', () => {
  expect(workflow.getIn(['concurrency', 'group'])).toBe(
    "${{ github.workflow }}-${{ github.ref }}-${{ (github.event_name == 'push' && github.ref == 'refs/heads/main') && github.sha || '' }}"
  )
})

it('runs the required check even when a dependency fails or is skipped', () => {
  expect(workflow.toJS()).toMatchObject({
    jobs: {
      test: {
        if: '${{ always() }}',
        needs: ['changes', 'test-shards', 'test-packages', 'test-report']
      },
      'test-packages': {
        needs: 'changes',
        if: "${{ needs.changes.outputs.should-run == 'true' }}"
      },
      'test-report': {
        needs: ['test-shards', 'test-packages']
      }
    }
  })
})

it.for`
  changes        | shouldRun  | shards         | packages       | report         | status
  ${'success'}   | ${'true'}  | ${'success'}   | ${'success'}   | ${'success'}   | ${0}
  ${'success'}   | ${'false'} | ${'skipped'}   | ${'skipped'}   | ${'skipped'}   | ${0}
  ${'failure'}   | ${''}      | ${'skipped'}   | ${'skipped'}   | ${'skipped'}   | ${1}
  ${'cancelled'} | ${''}      | ${'skipped'}   | ${'skipped'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${''}      | ${'skipped'}   | ${'skipped'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'failure'}   | ${'success'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'cancelled'} | ${'success'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'skipped'}   | ${'success'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'success'}   | ${'failure'}   | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'success'}   | ${'cancelled'} | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'success'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'false'} | ${'failure'}   | ${'skipped'}   | ${'skipped'}   | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'failure'}   | ${'success'}   | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'cancelled'} | ${'success'}   | ${1}
  ${'success'}   | ${'true'}  | ${'success'}   | ${'skipped'}   | ${'success'}   | ${1}
  ${'success'}   | ${'false'} | ${'skipped'}   | ${'failure'}   | ${'skipped'}   | ${1}
`(
  'unit check exits $status for changes=$changes, shouldRun=$shouldRun, shards=$shards, packages=$packages, report=$report',
  ({ changes, shouldRun, shards, packages, report, status }) => {
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CHANGES: changes,
        SHOULD_RUN: shouldRun,
        SHARDS: shards,
        PACKAGES: packages,
        REPORT: report
      }
    })

    expect(result.status).toBe(status)
  }
)
