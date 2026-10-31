import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const workflowPath = '.github/workflows/release-npm-types.yaml'

function stepBlock(name: string): string {
  const lines = readFileSync(workflowPath, 'utf8').split(/\r?\n/)
  const heading = `- name: ${name}`
  const start = lines.findIndex((line) => line.trimEnd().endsWith(heading))
  expect(start, `missing workflow step ${name}`).toBeGreaterThanOrEqual(0)

  const indent = lines[start].length - lines[start].trimStart().length
  const nextStep = new RegExp(`^\\s{${indent}}- `)
  const relativeEnd = lines
    .slice(start + 1)
    .findIndex((line) => nextStep.test(line))
  return lines
    .slice(start, relativeEnd === -1 ? undefined : start + 1 + relativeEnd)
    .join('\n')
}

describe('frontend types release dependencies', () => {
  it('publishes a missing desktop bridge dependency before building types', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const step = stepBlock(
      'Ensure desktop bridge types dependency is published'
    )
    const stepStart = workflow.indexOf(step)
    const buildStart = workflow.indexOf('Build types')

    expect(stepStart).toBeGreaterThan(-1)
    expect(buildStart).toBeGreaterThan(stepStart)
    expect(step).toContain(
      'BRIDGE_PACKAGE=packages/comfyui-desktop-bridge-types/package.json'
    )
    expect(step).toContain("require('./${BRIDGE_PACKAGE}').name")
    expect(step).toContain('npm view "${NAME}@${VERSION}" --json')
    expect(step).toContain('grep -q "E404"')
    expect(step).toContain('::error title=Registry lookup failed::')
    expect(step).toContain(
      'pnpm --dir packages/comfyui-desktop-bridge-types publish'
    )
    expect(step).toContain('--tag "$DIST_TAG"')
    expect(step).toContain('NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}')
  })
})
