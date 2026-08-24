import { describe, expect, it } from 'vitest'

import {
  extractEnumValues,
  formatInitialFeatureFlags,
  parseFeatureFlagSpecs
} from './featureFlags'

describe('parseFeatureFlagSpecs', () => {
  it('parses bare and JSON values while preserving colons', () => {
    expect(
      parseFeatureFlagSpecs([
        'enabled',
        'disabled:false',
        'count:12',
        'label:"12"',
        'url:https://example.com:8188'
      ])
    ).toEqual({
      enabled: true,
      disabled: false,
      count: 12,
      label: '12',
      url: 'https://example.com:8188'
    })
  })
})

describe('formatInitialFeatureFlags', () => {
  it('formats a fixture override above a test', () => {
    expect(
      formatInitialFeatureFlags({
        onboarding_tour_enabled: true,
        label: "it's ready"
      })
    ).toBe(`test.use({
  initialFeatureFlags: {
    onboarding_tour_enabled: true,
    label: 'it\\'s ready'
  }
})`)
  })
})

describe('extractEnumValues', () => {
  it('extracts string values only from ServerFeatureFlag', () => {
    const source = `
export enum OtherFlag { OTHER = 'other' }
export enum ServerFeatureFlag {
  ONBOARDING = 'onboarding_tour_enabled',
  ASSET_RENAME = "asset_rename_enabled"
}
`
    expect(extractEnumValues(source)).toEqual([
      'onboarding_tour_enabled',
      'asset_rename_enabled'
    ])
  })
})
