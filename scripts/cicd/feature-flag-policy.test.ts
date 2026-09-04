import { describe, expect, it } from 'vitest'

import {
  evaluatePolicy,
  hasFailClosedDefault,
  inferFlags,
  parseDeclaredFlag,
  riskFromLabels,
  runtimePathsFor
} from './feature-flag-policy'

const blankBody = `
## Feature flag

- **Flag**:
`
const declaredBody = blankBody.replace('**Flag**:', '**Flag**: safe_feature')
const registry = `
export enum ServerFeatureFlag {
  SAFE_FEATURE = 'safe_feature',
  OTHER_FEATURE = 'other_feature'
}
const enabled = resolveFlag(
  ServerFeatureFlag.SAFE_FEATURE,
  remoteConfig.value.safe_feature,
  false
)
`
const safePatch = `
@@ -1,0 +1,2 @@
+const enabled = flags.get(ServerFeatureFlag.SAFE_FEATURE)
`

describe('parseDeclaredFlag', () => {
  it('accepts a declared or blank flag', () => {
    expect(parseDeclaredFlag(declaredBody)).toEqual({
      flag: 'safe_feature',
      errors: []
    })
    expect(parseDeclaredFlag(blankBody)).toEqual({ flag: null, errors: [] })
    expect(parseDeclaredFlag('## Summary')).toEqual({ flag: null, errors: [] })
  })

  it('rejects duplicate flag fields', () => {
    const duplicate = `${declaredBody}- **Flag**: other_feature\n`
    expect(parseDeclaredFlag(duplicate).errors).toContain(
      'The `Flag` field must be unique.'
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

describe('inferFlags', () => {
  it('infers a unique flag from added code', () => {
    expect(inferFlags(registry, [safePatch])).toEqual(['safe_feature'])
  })

  it('returns every candidate when the diff is ambiguous', () => {
    const patch = `${safePatch}+flags.get(ServerFeatureFlag.OTHER_FEATURE)\n`
    expect(inferFlags(registry, [patch])).toEqual([
      'safe_feature',
      'other_feature'
    ])
  })
})

describe('hasFailClosedDefault', () => {
  it('accepts a registered flag with a false fallback', () => {
    expect(hasFailClosedDefault('safe_feature', registry)).toBe(true)
  })

  it('rejects a non-fail-closed fallback', () => {
    expect(
      hasFailClosedDefault(
        'safe_feature',
        registry.replace('false', 'isNightly')
      )
    ).toBe(false)
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
  const runtimeInput = {
    labels: [],
    risk: 'high' as const,
    runtimePaths: ['src/runtime.ts'],
    registrySource: registry,
    baseRegistrySource: registry
  }

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

  it('accepts a labeled exception without template evidence', () => {
    expect(
      evaluatePolicy({
        body: '',
        labels: ['flag-exempt'],
        risk: 'xhigh',
        runtimePaths: ['src/runtime.ts']
      }).verdict
    ).toBe('pass')
  })

  it('infers a registered default-off flag', () => {
    expect(
      evaluatePolicy({ ...runtimeInput, body: blankBody, patches: [safePatch] })
    ).toMatchObject({
      verdict: 'pass',
      requiresAi: true,
      flag: 'safe_feature',
      flagOrigin: 'existing',
      flagDiscovery: 'inferred'
    })
  })

  it('accepts an explicit registered default-off flag', () => {
    expect(
      evaluatePolicy({ ...runtimeInput, body: declaredBody, patches: [] })
    ).toMatchObject({
      verdict: 'pass',
      requiresAi: true,
      flag: 'safe_feature',
      flagDiscovery: 'declared'
    })
  })

  it('asks the author only when no single flag can be identified', () => {
    expect(
      evaluatePolicy({ ...runtimeInput, body: blankBody, patches: [] })
    ).toMatchObject({ verdict: 'inconclusive', requiresAi: true })
  })

  it('rejects an explicit flag without a fail-closed registration', () => {
    const result = evaluatePolicy({
      ...runtimeInput,
      body: declaredBody.replace('safe_feature', 'invented_flag'),
      patches: []
    })
    expect(result.verdict).toBe('fail')
    expect(result.reasons).toContain(
      'Flag `invented_flag` is not registered with a fail-closed default.'
    )
  })
})
