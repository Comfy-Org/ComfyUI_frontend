import { describe, expect, it } from 'vitest'

import {
  evaluatePolicy,
  hasFailClosedDefault,
  parsePolicyFields,
  riskFromLabels,
  runtimePathsFor
} from './feature-flag-policy'

const validBody = `
## Feature flag

- **Cloud runtime change**: yes
- **Flag**: safe_feature
- **Flag source**: new
- **Default-OFF code evidence**: src/composables/useFeatureFlags.ts:100
- **Production-OFF evidence**: https://flags.example/safe_feature
- **Flag-OFF behavior**: Existing behavior remains unchanged.
- **Flag-OFF test**: src/safeFeature.test.ts:test off path
- **Exception**: none
- **Exception evidence**: N/A
`

const registry = `
export enum ServerFeatureFlag {
  SAFE_FEATURE = 'safe_feature'
}
const enabled = resolveFlag(
  ServerFeatureFlag.SAFE_FEATURE,
  remoteConfig.value.safe_feature,
  false
)
`

describe('parsePolicyFields', () => {
  it('reads the fixed template fields', () => {
    expect(parsePolicyFields(validBody).fields).toMatchObject({
      cloudRuntimeChange: 'yes',
      flag: 'safe_feature',
      exception: 'none'
    })
  })

  it('rejects a missing section', () => {
    expect(parsePolicyFields('## Summary\nNo policy').errors).toContain(
      'Missing `## Feature flag` section.'
    )
  })

  it('rejects duplicate fields', () => {
    const duplicate = validBody.replace(
      '- **Flag**: safe_feature',
      '- **Flag**: unsafe_feature\n- **Flag**: safe_feature'
    )
    expect(parsePolicyFields(duplicate).errors).toContain(
      'Policy fields must be unique.'
    )
  })
})

describe('runtimePathsFor', () => {
  const riskMap = {
    path_rules: [
      { class: 'core-infra', paths: ['src/core/**'] },
      { class: 'tests', paths: ['**/*.test.ts'] },
      { class: 'docs', paths: ['**/*.md'] }
    ]
  }

  it('lets explicit non-runtime classes win over overlapping runtime classes', () => {
    expect(
      runtimePathsFor(
        [
          { filename: 'src/core/runtime.ts' },
          { filename: 'src/core/runtime.test.ts' },
          { filename: 'docs/policy.md' }
        ],
        riskMap
      )
    ).toEqual(['src/core/runtime.ts'])
  })

  it('treats unclassified files as runtime instead of silently exempting them', () => {
    expect(
      runtimePathsFor([{ filename: 'src/components/NewUi.vue' }], riskMap)
    ).toEqual(['src/components/NewUi.vue'])
  })
})

describe('hasFailClosedDefault', () => {
  it('accepts a registered flag with a false fallback', () => {
    expect(hasFailClosedDefault('safe_feature', registry, registry)).toBe(true)
  })

  it('rejects a nightly-on fallback', () => {
    const unsafe = registry.replace('false', 'isNightly')
    expect(hasFailClosedDefault('safe_feature', unsafe, unsafe)).toBe(false)
  })
})

describe('riskFromLabels', () => {
  it('uses a dispute label as the effective grade', () => {
    expect(riskFromLabels(['risk:xhigh', 'risk-dispute:medium'])).toBe('medium')
  })

  it('rejects conflicting dispute labels', () => {
    expect(riskFromLabels(['risk-dispute:medium', 'risk-dispute:high'])).toBe(
      'conflict'
    )
  })
})

describe('evaluatePolicy', () => {
  it('passes low-risk changes without parsing the template', () => {
    expect(
      evaluatePolicy({
        body: '',
        labels: [],
        risk: 'low',
        runtimePaths: ['src/runtime.ts']
      }).verdict
    ).toBe('pass')
  })

  it('passes mechanically exempt high-risk changes', () => {
    expect(
      evaluatePolicy({
        body: '',
        labels: [],
        risk: 'xhigh',
        runtimePaths: []
      }).verdict
    ).toBe('pass')
  })

  it('requires complete default-off containment for runtime changes', () => {
    expect(
      evaluatePolicy({
        body: validBody,
        labels: [],
        risk: 'high',
        runtimePaths: ['src/runtime.ts'],
        registrySource: registry,
        evidenceSource: registry,
        testPathExists: true
      })
    ).toMatchObject({ verdict: 'pass', requiresAi: true })
  })

  it('rejects prose that names no registered flag', () => {
    expect(
      evaluatePolicy({
        body: validBody.replaceAll('safe_feature', 'invented_flag'),
        labels: [],
        risk: 'high',
        runtimePaths: ['src/runtime.ts'],
        registrySource: registry,
        evidenceSource: registry,
        testPathExists: true
      }).reasons
    ).toContain('The named flag is not registered with a fail-closed default.')
  })

  it('requires the test evidence to name a test file', () => {
    const body = validBody.replace(
      'src/safeFeature.test.ts:test off path',
      'src/safeFeature.ts:test off path'
    )
    expect(
      evaluatePolicy({
        body,
        labels: [],
        risk: 'high',
        runtimePaths: ['src/runtime.ts'],
        registrySource: registry,
        evidenceSource: registry,
        testPathExists: true
      }).reasons
    ).toContain('`Flag-OFF test` must reference a test file.')
  })

  it('requires the explicit label for a human exception', () => {
    const exceptionBody = validBody
      .replace('- **Exception**: none', '- **Exception**: contract')
      .replace(
        '- **Exception evidence**: N/A',
        '- **Exception evidence**: Validation link and rollback steps.'
      )
    expect(
      evaluatePolicy({
        body: exceptionBody,
        labels: [],
        risk: 'xhigh',
        runtimePaths: ['src/runtime.ts']
      }).reasons
    ).toContain('An exception requires the `flag-exempt` label.')
    expect(
      evaluatePolicy({
        body: exceptionBody,
        labels: ['flag-exempt'],
        risk: 'xhigh',
        runtimePaths: ['src/runtime.ts']
      }).verdict
    ).toBe('pass')

    expect(
      evaluatePolicy({
        body: exceptionBody.replace(
          'Validation link and rollback steps.',
          'n/a'
        ),
        labels: ['flag-exempt'],
        risk: 'xhigh',
        runtimePaths: ['src/runtime.ts']
      }).reasons
    ).toContain('`Exception evidence` must include validation and rollback.')
  })
})
