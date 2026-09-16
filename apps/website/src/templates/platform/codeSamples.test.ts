import { describe, expect, it } from 'vitest'

import { routerCodeTabs } from './codeSamples'

describe('routerCodeTabs', () => {
  it('cycles every supported provider in each language sample', () => {
    const providers = ['fal', 'runware', 'wavespeed']

    for (const tab of Object.values(routerCodeTabs)) {
      const providerSegment = tab.segments.find(
        (segment) => typeof segment !== 'string' && segment.highlight
      )

      expect(providerSegment).toEqual({ values: providers, highlight: true })
    }
  })
})
