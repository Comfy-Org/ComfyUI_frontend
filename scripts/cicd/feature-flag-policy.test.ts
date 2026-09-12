import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import riskMap from '../../.github/risk.json'
import { checkOutput, evaluatePolicy } from './feature-flag-policy'

const declaredBody = '## Feature flag\n\n- **Flag**: safe_feature\n'
const runtime = { filename: 'src/platform/workspace/api/workspaceApi.ts' }

describe('feature flag advice', () => {
  it('excludes the test and tooling portion of #17309', () => {
    const files = [
      '.agents/checks/playwright-e2e.md',
      '.claude/agents/playwright-test-generator.md',
      '.claude/skills/codegen-transform/SKILL.md',
      '.oxlintrc.json',
      'browser_tests/fixtures/ComfyPage.ts',
      'browser_tests/fixtures/helpers/WorkflowHelper.ts',
      'browser_tests/tests/canvasSettings.spec.ts'
    ].map((filename) => ({ filename }))
    expect(evaluatePolicy(files, riskMap, '')).toMatchObject({
      verdict: 'not-applicable',
      paths: []
    })
  })

  it('keeps colocated tests out of runtime scope', () => {
    expect(
      evaluatePolicy(
        [
          { filename: 'src/platform/workspace/api/workspaceApi.test.ts' },
          { filename: 'src/lib/litegraph/test/LGraph.test.ts' }
        ],
        riskMap,
        ''
      ).verdict
    ).toBe('not-applicable')
  })

  it.for([
    'playwright.config.ts',
    'playwright.cloud.config.ts',
    'vitest.setup.ts',
    'tools/test-recorder/src/index.ts',
    'eslint.config.ts',
    '.github/workflows/test.yaml'
  ])('does not require a runtime flag for tooling: %s', (filename) => {
    expect(evaluatePolicy([{ filename }], riskMap, '').verdict).toBe(
      'not-applicable'
    )
  })

  it('does not exempt a mixed PR when it also contains tests or tooling', () => {
    const result = evaluatePolicy(
      [
        runtime,
        { filename: '.oxlintrc.json' },
        { filename: 'browser_tests/tests/billing.spec.ts' }
      ],
      riskMap,
      ''
    )
    expect(result).toMatchObject({
      verdict: 'needs-flag',
      paths: [runtime.filename]
    })
    expect(result.reasons).toContain(`${runtime.filename}: billing (R3)`)
  })

  it.for([
    {
      filename: 'browser_tests/removed.ts',
      previous_filename: runtime.filename
    },
    { filename: runtime.filename, previous_filename: 'browser_tests/helper.ts' }
  ])('reviews runtime on either side of a rename', (file) => {
    expect(evaluatePolicy([file], riskMap, '').verdict).toBe('needs-flag')
  })

  it.for([
    'src/components/NewFeature.vue',
    'new-config.json',
    'public/runtime.js'
  ])(
    'asks for scope review of an unclassified path without demanding a flag: %s',
    (filename) => {
      expect(evaluatePolicy([{ filename }], riskMap, '')).toMatchObject({
        verdict: 'review-required',
        paths: [filename]
      })
    }
  )

  it.for([
    ['src/platform/keybindings/keybindingService.ts'],
    [
      'src/composables/useLoad3d.ts',
      'src/extensions/core/load3d.ts',
      'src/extensions/core/load3d/model3dOutput.ts',
      'src/extensions/core/load3dPreviewExtensions.ts'
    ]
  ])('retains runtime scope in the reported mixed PRs: %j', (paths) => {
    const files = paths.flatMap((filename) => [
      { filename },
      { filename: filename.replace(/\.ts$/, '.test.ts') }
    ])
    expect(evaluatePolicy(files, riskMap, '')).toMatchObject({
      verdict: 'review-required',
      paths
    })
  })

  it('does not mistake a declaration for verified rollout safety', () => {
    const result = evaluatePolicy([runtime], riskMap, declaredBody)
    expect(result.verdict).toBe('review-required')
    expect(result.reasons.join('\n')).toContain(
      'A declaration is not verification.'
    )
  })

  it.for([
    '',
    '## Feature flag\n- **Flag**: none',
    '## Feature flag\n- **Flag**: TODO',
    '## Feature flag\n- **Flag**: safe_feature\n- **Flag**: other',
    '## Summary\n- **Flag**: safe_feature',
    '## Feature flag\n\n## Summary\n- **Flag**: safe_feature'
  ])(
    'reports missing or ambiguous declarations without a failing check',
    (body) => {
      const result = evaluatePolicy([runtime], riskMap, body)
      expect(result.verdict).toBe('needs-flag')
      expect(checkOutput(result, 'abc123')).toMatchObject({
        head_sha: 'abc123',
        conclusion: 'neutral'
      })
    }
  )

  it('does not feed any advice verdict back into the risk grader as a CI failure', () => {
    const results = [
      evaluatePolicy([{ filename: '.oxlintrc.json' }], riskMap, ''),
      evaluatePolicy([runtime], riskMap, ''),
      evaluatePolicy([runtime], riskMap, declaredBody)
    ]
    expect(new Set(results.map((result) => result.verdict)).size).toBe(3)
    for (const result of results) {
      expect(checkOutput(result, 'abc123').conclusion).toBe('neutral')
    }
  })

  it('recognizes the feature flag field in the actual PR template', () => {
    const template = readFileSync('.github/pull_request_template.md', 'utf8')
    expect(
      evaluatePolicy(
        [runtime],
        riskMap,
        template.replace('**Flag**:', '**Flag**: safe_feature')
      ).verdict
    ).toBe('review-required')
  })
})
