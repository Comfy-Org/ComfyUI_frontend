import { describe, expect, it } from 'vitest'

import { getCanonicalTags } from '../../vite.config.mts'

describe('canonical tags', () => {
  it('publishes only the cloud root as canonical', () => {
    expect(getCanonicalTags('cloud')).toEqual([
      {
        tag: 'link',
        attrs: { rel: 'canonical', href: 'https://cloud.comfy.org/' },
        injectTo: 'head'
      }
    ])
  })

  it('does not publish route-specific canonicals for other distributions', () => {
    expect(getCanonicalTags('desktop')).toEqual([])
    expect(getCanonicalTags(undefined)).toEqual([])
  })
})
