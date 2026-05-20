import { describe, expect, it } from 'vitest'

import {
  readAttributionFromSearch,
  withPreservedAttribution
} from './attribution'

describe('readAttributionFromSearch', () => {
  it('reads UTM parameters and ad click IDs', () => {
    const attribution = readAttributionFromSearch(
      '?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=123&fbclid=456&ignored=value'
    )

    expect(attribution).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'spring',
      gclid: '123',
      fbclid: '456'
    })
  })

  it('ignores empty attribution values', () => {
    const attribution = readAttributionFromSearch(
      '?utm_source=&utm_medium=cpc&gclid='
    )

    expect(attribution).toEqual({
      utm_medium: 'cpc'
    })
  })
})

describe('withPreservedAttribution', () => {
  const attribution = {
    utm_source: 'google',
    utm_medium: 'cpc',
    gclid: 'abc123'
  }

  it('adds attribution to Cloud links', () => {
    expect(
      withPreservedAttribution(
        'https://cloud.comfy.org',
        attribution,
        'https://comfy.org'
      )
    ).toBe(
      'https://cloud.comfy.org/?utm_source=google&utm_medium=cpc&gclid=abc123'
    )
  })

  it('keeps checkout parameters while replacing hardcoded attribution', () => {
    expect(
      withPreservedAttribution(
        'https://cloud.comfy.org/cloud/subscribe?tier=creator&cycle=monthly&utm_source=workflow_hub',
        attribution,
        'https://comfy.org'
      )
    ).toBe(
      'https://cloud.comfy.org/cloud/subscribe?tier=creator&cycle=monthly&utm_source=google&utm_medium=cpc&gclid=abc123'
    )
  })

  it('keeps relative links relative', () => {
    expect(
      withPreservedAttribution(
        '/cloud#pricing',
        attribution,
        'https://comfy.org'
      )
    ).toBe('/cloud?utm_source=google&utm_medium=cpc&gclid=abc123#pricing')
  })

  it('preserves attribution on the workflows app route', () => {
    expect(
      withPreservedAttribution(
        'https://comfy.org/workflows',
        attribution,
        'https://comfy.org'
      )
    ).toBe(
      'https://comfy.org/workflows?utm_source=google&utm_medium=cpc&gclid=abc123'
    )
  })

  it('adds attribution to platform links', () => {
    expect(
      withPreservedAttribution(
        'https://platform.comfy.org/profile/api-keys',
        attribution,
        'https://comfy.org'
      )
    ).toBe(
      'https://platform.comfy.org/profile/api-keys?utm_source=google&utm_medium=cpc&gclid=abc123'
    )
  })

  it('does not add attribution to unrelated external destinations', () => {
    expect(
      withPreservedAttribution(
        'https://docs.comfy.org/api-reference/cloud',
        attribution,
        'https://comfy.org'
      )
    ).toBe('https://docs.comfy.org/api-reference/cloud')
  })
})
