import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  id?: string
  uses?: string
  run?: string
  with?: {
    path?: string
    ref?: string
    version?: number | string
    package_json_file?: string
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isWorkflowStep = (value: unknown): value is WorkflowStep => {
  if (!isRecord(value)) return false
  const optionalStrings = ['name', 'id', 'uses', 'run']
  if (
    optionalStrings.some(
      (key) => value[key] !== undefined && typeof value[key] !== 'string'
    )
  ) {
    return false
  }
  return value.with === undefined || isRecord(value.with)
}

/**
 * Read the `publish-pypi` steps out of the workflow without asserting the
 * parsed YAML's shape: a bad parse should fail here with a clear message
 * rather than surface as an unrelated undefined further down.
 */
const readPublishPypiSteps = (path: string): WorkflowStep[] => {
  const parsed: unknown = parse(readFileSync(path, 'utf8'))
  expect(isRecord(parsed), `${path} did not parse to a mapping`).toBe(true)

  const jobs = (parsed as Record<string, unknown>).jobs
  expect(isRecord(jobs), `${path} has no jobs mapping`).toBe(true)

  const job = (jobs as Record<string, unknown>)['publish-pypi']
  expect(isRecord(job), `${path} has no publish-pypi job`).toBe(true)

  const steps = (job as Record<string, unknown>).steps
  expect(Array.isArray(steps), 'publish-pypi has no steps array').toBe(true)
  expect((steps as unknown[]).every(isWorkflowStep)).toBe(true)

  return steps as WorkflowStep[]
}

const steps = readPublishPypiSteps(
  '.github/workflows/release-weekly-comfyui.yaml'
)

const indexOfStep = (name: string) =>
  steps.findIndex((step) => step.name === name)

describe('weekly ComfyUI release', () => {
  const checkoutIndex = indexOfStep('Checkout code at target version')
  const resolveIndex = indexOfStep('Resolve legacy pnpm version')
  const pnpmIndex = indexOfStep('Install pnpm')

  it('checks out the release tag being published', () => {
    expect(checkoutIndex).toBeGreaterThanOrEqual(0)
    expect(steps[checkoutIndex].uses).toMatch(/^actions\/checkout@/)
    expect(steps[checkoutIndex].with?.ref).toBe(
      'v${{ needs.resolve-version.outputs.target_version }}'
    )
  })

  it('installs pnpm only after the release tag is checked out', () => {
    expect(pnpmIndex).toBeGreaterThan(checkoutIndex)
    expect(steps[pnpmIndex].uses).toMatch(/^pnpm\/action-setup@/)
  })

  it('reads the pnpm version from the checked-out tag, not the default branch', () => {
    const checkoutPath = steps[checkoutIndex].with?.path
    expect(checkoutPath).toBeTruthy()
    expect(steps[pnpmIndex].with?.package_json_file).toBe(
      `${checkoutPath}/package.json`
    )
  })

  it('feeds the version input from the resolver rather than a hardcoded pin', () => {
    // A literal here would break every release that bumps pnpm, and would make
    // pnpm/action-setup throw "Multiple versions of pnpm specified" for any tag
    // whose package.json pins pnpm itself.
    const resolverId = steps[resolveIndex].id
    expect(resolverId).toBeTruthy()
    expect(String(steps[pnpmIndex].with?.version)).toBe(
      `\${{ steps.${resolverId}.outputs.version }}`
    )
  })

  it('resolves the fallback between the tag checkout and the pnpm install', () => {
    expect(resolveIndex).toBeGreaterThan(checkoutIndex)
    expect(pnpmIndex).toBeGreaterThan(resolveIndex)
  })

  it('runs the resolver from the staged copy, since the tag predates it', () => {
    // The tag checkout replaces `release/` with published code that has no
    // knowledge of this script, so it has to come from $RUNNER_TEMP/cicd.
    expect(steps[resolveIndex].run).toContain(
      '"$RUNNER_TEMP/cicd/resolve-legacy-pnpm-version.js"'
    )
  })
})
