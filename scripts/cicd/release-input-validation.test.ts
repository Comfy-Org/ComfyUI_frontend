import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { isMap, isSeq, parseDocument } from 'yaml'

const workflow = parseDocument(
  readFileSync('.github/workflows/release-npm-types.yaml', 'utf8')
)
const steps = workflow.getIn(['jobs', 'publish_types_manual', 'steps'], true)
if (!isSeq(steps)) throw new Error('Release steps missing')
const validationIndex = steps.items.findIndex(
  (step) => isMap(step) && step.get('name') === 'Validate inputs'
)
const checkoutIndex = steps.items.findIndex(
  (step) =>
    isMap(step) &&
    String(step.get('uses') ?? '').startsWith('actions/checkout@')
)
if (
  validationIndex < 0 ||
  checkoutIndex < 0 ||
  validationIndex >= checkoutIndex
) {
  throw new Error('Input validation must run before checkout')
}
const validation = steps.items[validationIndex]
if (!isMap(validation)) throw new Error('Input validation step missing')
const script = String(validation.get('run'))

describe('release input validation', () => {
  it.for(['latest', 'next', 'beta-1', 'a'.repeat(64)])(
    'accepts distribution tag %s',
    (tag) => {
      const result = spawnSync('bash', ['-c', script], {
        env: { PATH: process.env.PATH, VERSION: '1.2.3', DIST_TAG: tag },
        encoding: 'utf8'
      })
      expect(result.status, result.stderr).toBe(0)
    }
  )

  it.for([
    '',
    'Latest',
    '-latest',
    'a'.repeat(65),
    '$(exit 42)',
    'latest"; exit 42; #',
    'latest\nnext'
  ])('rejects distribution tag %s before checkout', (tag) => {
    const result = spawnSync('bash', ['-c', script], {
      env: { PATH: process.env.PATH, VERSION: '1.2.3', DIST_TAG: tag },
      encoding: 'utf8'
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Invalid npm distribution tag')
  })

  it('passes inputs as data instead of interpolating shell source', () => {
    for (const step of steps.items) {
      if (!isMap(step)) throw new Error('Invalid release step')
      expect(String(step.get('run') ?? '')).not.toMatch(
        /\$\{\{[^}]*\binputs\s*(?:\.|\[)/
      )
    }
  })
})

describe('workflow shell input boundaries', () => {
  it.for(
    readdirSync('.github/workflows').filter((name) => /\.ya?ml$/.test(name))
  )('%s keeps dispatch inputs out of executable shell source', (name) => {
    const document = parseDocument(
      readFileSync(`.github/workflows/${name}`, 'utf8')
    )
    const jobs = document.get('jobs', true)
    if (!isMap(jobs)) throw new Error('Missing workflow jobs')
    for (const { value: job } of jobs.items) {
      if (!isMap(job)) throw new Error('Invalid job')
      const jobSteps = job.get('steps', true)
      if (!isSeq(jobSteps)) continue
      for (const step of jobSteps.items) {
        if (!isMap(step)) throw new Error('Invalid step')
        expect(String(step.get('run') ?? '')).not.toMatch(
          /\$\{\{[^}]*\binputs\s*(?:\.|\[)/
        )
      }
    }
  })
})
