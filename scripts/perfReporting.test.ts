import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import config from '../playwright.config'

const workflowPath = '.github/workflows/ci-perf-report.yaml'
const performanceSpecPath = 'browser_tests/tests/performance.spec.ts'

function workflowStep(name: string): string {
  const lines = readFileSync(workflowPath, 'utf8').split(/\r?\n/)
  const heading = `- name: ${name}`
  const startIndex = lines.findIndex((line) => line.trimEnd().endsWith(heading))
  expect(startIndex, `missing workflow step ${name}`).toBeGreaterThanOrEqual(0)

  const indent = lines[startIndex].length - lines[startIndex].trimStart().length
  const nextStep = new RegExp(`^\\s{${indent}}- `)
  const endIndex = lines
    .slice(startIndex + 1)
    .findIndex((line) => nextStep.test(line))
  return lines
    .slice(startIndex, endIndex === -1 ? undefined : startIndex + 1 + endIndex)
    .join('\n')
}

describe('performance baseline reporting', () => {
  it('quarantines the flaky subgraph transition without excluding other perf tests', () => {
    const project = config.projects?.find(
      (entry) => entry.name === 'performance'
    )
    const spec = readFileSync(performanceSpecPath, 'utf8')

    expect(project?.grep?.source).toContain('@perf')
    expect(project?.grepInvert?.source).toContain('@perf-quarantine')
    expect(spec).toContain("{ tag: ['@vue-nodes', '@perf-quarantine'] }")
  })

  it('persists completed main-branch measurements instead of requiring every test to pass', () => {
    const runStep = workflowStep('Run performance tests')
    const saveStep = workflowStep('Save perf baseline to perf-data branch')

    expect(runStep).toContain('continue-on-error: true')
    expect(saveStep).not.toContain('continue-on-error: true')
    expect(saveStep).not.toContain("steps.perf.outcome == 'success'")
    expect(saveStep).toContain('!cancelled()')
    expect(saveStep).toContain('test -s test-results/perf-metrics.json')
    expect(saveStep).toContain('report.measurements?.length ?? 0')
    expect(saveStep).toContain(
      'refusing to skip the main-branch baseline update'
    )
  })
})
