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
    version?: number | string
    package_json_file?: string
  }
}

interface Workflow {
  jobs?: {
    'publish-pypi'?: {
      steps?: WorkflowStep[]
    }
  }
}

const steps = (() => {
  const workflow = parse(
    readFileSync('.github/workflows/release-weekly-comfyui.yaml', 'utf8')
  ) as Workflow
  return workflow.jobs?.['publish-pypi']?.steps ?? []
})()

const indexOfStep = (name: string) =>
  steps.findIndex((step) => step.name === name)

describe('weekly ComfyUI release', () => {
  const checkoutIndex = indexOfStep('Checkout code at target version')
  const resolveIndex = indexOfStep('Resolve legacy pnpm version')
  const pnpmIndex = indexOfStep('Install pnpm')

  it('installs pnpm only after the release tag is checked out', () => {
    expect(checkoutIndex).toBeGreaterThanOrEqual(0)
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
