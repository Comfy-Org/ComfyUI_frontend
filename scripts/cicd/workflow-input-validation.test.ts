import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { isMap, isSeq, parseDocument } from 'yaml'
import type { Document, YAMLMap } from 'yaml'

const INPUT_EXPRESSION = /\$\{\{[^}]*\binputs\s*(?:\.|\[)/
const DERIVED_EXPRESSION = /\$\{\{[^}]*\b(?:steps|needs)\.[^}]*\.outputs\b/
const CHANGED_WORKFLOWS = [
  'i18n-update-custom-nodes.yaml',
  'pr-backport.yaml',
  'release-npm-types.yaml',
  'release-recover-tag.yaml',
  'release-weekly-comfyui.yaml'
]

function loadWorkflow(name: string): Document {
  return parseDocument(readFileSync(`.github/workflows/${name}`, 'utf8'))
}

function jobsOf(workflow: Document): YAMLMap[] {
  const jobs = workflow.get('jobs', true)
  if (!isMap(jobs)) throw new Error('Missing workflow jobs')
  return jobs.items.map(({ value }) => {
    if (!isMap(value)) throw new Error('Invalid job')
    return value
  })
}

function stepsOf(job: YAMLMap): YAMLMap[] {
  const steps = job.get('steps', true)
  if (!isSeq(steps)) return []
  return steps.items.map((step) => {
    if (!isMap(step)) throw new Error('Invalid step')
    return step
  })
}

function jobSteps(workflow: Document, jobName: string): YAMLMap[] {
  const job = workflow.getIn(['jobs', jobName], true)
  if (!isMap(job)) throw new Error(`Missing job ${jobName}`)
  return stepsOf(job)
}

function stepNamed(steps: YAMLMap[], name: string): number {
  return steps.findIndex((step) => step.get('name') === name)
}

function checkoutIndex(steps: YAMLMap[]): number {
  return steps.findIndex((step) =>
    String(step.get('uses') ?? '').startsWith('actions/checkout@')
  )
}

function scriptOf(steps: YAMLMap[], name: string): string {
  const index = stepNamed(steps, name)
  return index < 0 ? '' : String(steps[index].get('run') ?? '')
}

function runScript(script: string, env: Record<string, string>) {
  return spawnSync('bash', ['-c', script], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8'
  })
}

function transportedNames(job: YAMLMap, step: YAMLMap): string[] {
  const names: string[] = []
  for (const scope of [job, step]) {
    const env = scope.get('env', true)
    if (!isMap(env)) continue
    for (const { key, value } of env.items) {
      const expression = String(value)
      if (
        INPUT_EXPRESSION.test(expression) ||
        DERIVED_EXPRESSION.test(expression)
      ) {
        names.push(String(key))
      }
    }
  }
  return names
}

function unquotedExpansions(script: string, names: string[]): string[] {
  const found: string[] = []
  const stack: ('plain' | 'single' | 'double')[] = ['plain']
  const lines = script.split('\n')
  let heredocEnd: string | undefined
  for (const line of lines) {
    if (heredocEnd !== undefined) {
      if (line.trim() === heredocEnd) heredocEnd = undefined
      continue
    }
    const heredoc = /<<-?\s*(['"]?)(\w+)\1/.exec(line)
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const state = stack[stack.length - 1]
      if (state !== 'single' && char === '\\') {
        i++
        continue
      }
      if (state === 'single') {
        if (char === "'") stack.pop()
        continue
      }
      if (char === "'" && state === 'plain') {
        stack.push('single')
        continue
      }
      if (char === '"') {
        if (state === 'double') stack.pop()
        else stack.push('double')
        continue
      }
      if (char === '$' && line[i + 1] === '(') {
        stack.push('plain')
        i++
        continue
      }
      if (char === ')' && state === 'plain' && stack.length > 1) {
        stack.pop()
        continue
      }
      if (char === '$') {
        const match = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)/.exec(line.slice(i))
        if (match && names.includes(match[1]) && state !== 'double') {
          found.push(match[1])
        }
      }
    }
    if (heredoc) heredocEnd = heredoc[2]
  }
  return found
}

describe('release-npm-types.yaml', () => {
  const steps = jobSteps(
    loadWorkflow('release-npm-types.yaml'),
    'publish_types_manual'
  )
  const inputValidation = scriptOf(steps, 'Validate inputs')
  const distTagValidation = scriptOf(steps, 'Validate dist-tag')

  it('validates inputs before checkout', () => {
    expect(stepNamed(steps, 'Validate inputs')).toBeGreaterThanOrEqual(0)
    expect(stepNamed(steps, 'Validate inputs')).toBeLessThan(
      checkoutIndex(steps)
    )
  })

  it.for(['1.2.3', '1.2.3-beta.1', '1.2.3+build.7', '10.0.0-rc.1+sha.abc'])(
    'accepts version %s',
    (version) => {
      const result = runScript(inputValidation, {
        VERSION: version,
        DIST_TAG: 'latest'
      })
      expect({ status: result.status, stderr: result.stderr }).toEqual({
        status: 0,
        stderr: ''
      })
    }
  )

  it.for([
    '',
    'v1.2.3',
    '1.2',
    '01.2.3',
    '$(exit 42)',
    '1.2.3; exit 42',
    '1.2.3\n1.2.4'
  ])('rejects version %s before checkout', (version) => {
    const result = runScript(inputValidation, {
      VERSION: version,
      DIST_TAG: 'latest'
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Invalid version')
  })

  it('rejects an empty distribution tag before checkout', () => {
    const result = runScript(inputValidation, {
      VERSION: '1.2.3',
      DIST_TAG: ''
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dist_tag must not be empty')
  })

  it('validates the distribution tag after install and before publish', () => {
    const validation = stepNamed(steps, 'Validate dist-tag')
    expect(validation).toBeGreaterThan(stepNamed(steps, 'Install dependencies'))
    expect(validation).toBeLessThan(stepNamed(steps, 'Publish package'))
  })

  it.for([
    'latest',
    'next',
    'beta-1',
    'Beta_One',
    'beta.one',
    'rc_2026.09',
    'a'.repeat(65)
  ])('accepts distribution tag %s as npm does', (tag) => {
    const result = runScript(distTagValidation, { DIST_TAG: tag })
    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: ''
    })
  })

  it.for([
    '',
    '1.2.3',
    'v1.2.3',
    '>=1.0.0',
    '1.x',
    '~1.2',
    '^2',
    '*',
    '1.2.3 - 2.0.0'
  ])('rejects distribution tag %s as npm does', (tag) => {
    const result = runScript(distTagValidation, { DIST_TAG: tag })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Invalid dist-tag')
  })

  it('publishes with the distribution tag passed as quoted data', () => {
    expect(scriptOf(steps, 'Publish package')).toMatch(/--tag "\$DIST_TAG"/)
  })
})

describe('i18n-update-custom-nodes.yaml', () => {
  const steps = jobSteps(
    loadWorkflow('i18n-update-custom-nodes.yaml'),
    'update-locales'
  )
  const validation = scriptOf(steps, 'Validate repository inputs')
  const valid = {
    INPUT_OWNER: 'Comfy-Org',
    INPUT_REPOSITORY: 'ComfyUI_frontend',
    INPUT_FORK_OWNER: 'Comfy-Org'
  }

  it('validates repository inputs before checkout', () => {
    expect(
      stepNamed(steps, 'Validate repository inputs')
    ).toBeGreaterThanOrEqual(0)
    expect(stepNamed(steps, 'Validate repository inputs')).toBeLessThan(
      checkoutIndex(steps)
    )
  })

  it.for([
    valid,
    { INPUT_OWNER: 'a', INPUT_REPOSITORY: 'b', INPUT_FORK_OWNER: 'c' },
    {
      INPUT_OWNER: 'a'.repeat(39),
      INPUT_REPOSITORY: 'r'.repeat(100),
      INPUT_FORK_OWNER: '9-x'
    },
    { ...valid, INPUT_REPOSITORY: 'x.y-z_1' }
  ])('accepts repository inputs %o', (env) => {
    const result = runScript(validation, env)
    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: ''
    })
  })

  it.for([
    ['INPUT_OWNER', ''],
    ['INPUT_OWNER', 'a'.repeat(40)],
    ['INPUT_OWNER', '-leading'],
    ['INPUT_OWNER', 'a b'],
    ['INPUT_OWNER', '$(exit 42)'],
    ['INPUT_FORK_OWNER', ''],
    ['INPUT_FORK_OWNER', 'owner/extra'],
    ['INPUT_REPOSITORY', ''],
    ['INPUT_REPOSITORY', 'r'.repeat(101)],
    ['INPUT_REPOSITORY', '.hidden'],
    ['INPUT_REPOSITORY', '..'],
    ['INPUT_REPOSITORY', '../escape'],
    ['INPUT_REPOSITORY', 'a/b'],
    ['INPUT_REPOSITORY', 'a\nb'],
    ['INPUT_REPOSITORY', 'x; exit 42'],
    ['INPUT_REPOSITORY', '$(exit 42)']
  ] as const)('rejects %s=%j before checkout', ([name, value]) => {
    const result = runScript(validation, { ...valid, [name]: value })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/Invalid (owner|repository)/)
  })
})

describe('shell expansion scanner', () => {
  it('flags expansions outside double quotes, including inside $( )', () => {
    expect(
      unquotedExpansions('pnpm publish --tag $DIST_TAG', ['DIST_TAG'])
    ).toEqual(['DIST_TAG'])
    expect(
      unquotedExpansions('pnpm publish --tag "$DIST_TAG"', ['DIST_TAG'])
    ).toEqual([])
    expect(
      unquotedExpansions('X="$(gh pr view $N --json state)"', ['N'])
    ).toEqual(['N'])
    expect(
      unquotedExpansions('X="$(gh pr view "$N" --json state)"', ['N'])
    ).toEqual([])
    expect(unquotedExpansions("cat <<'EOF'\n$N\nEOF\necho $N", ['N'])).toEqual([
      'N'
    ])
  })
})

describe('workflow shell input boundaries', () => {
  it.for(
    readdirSync('.github/workflows').filter((name) => /\.ya?ml$/.test(name))
  )('%s keeps dispatch inputs out of executable shell source', (name) => {
    for (const job of jobsOf(loadWorkflow(name))) {
      for (const step of stepsOf(job)) {
        expect(String(step.get('run') ?? '')).not.toMatch(INPUT_EXPRESSION)
      }
    }
  })

  it.for(CHANGED_WORKFLOWS)(
    '%s expands transported inputs only inside double quotes',
    (name) => {
      for (const job of jobsOf(loadWorkflow(name))) {
        for (const step of stepsOf(job)) {
          const script = String(step.get('run') ?? '')
          expect({
            step: String(step.get('name')),
            unquoted: unquotedExpansions(script, transportedNames(job, step))
          }).toEqual({ step: String(step.get('name')), unquoted: [] })
        }
      }
    }
  )

  it.for(['release-npm-types.yaml', 'release-recover-tag.yaml'])(
    '%s keeps derived outputs out of executable shell source',
    (name) => {
      for (const job of jobsOf(loadWorkflow(name))) {
        for (const step of stepsOf(job)) {
          expect(String(step.get('run') ?? '')).not.toMatch(DERIVED_EXPRESSION)
        }
      }
    }
  )
})
