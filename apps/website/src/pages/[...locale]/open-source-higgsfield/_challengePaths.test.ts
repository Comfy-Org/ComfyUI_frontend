import { describe, expect, it, vi } from 'vitest'

import { challengeStaticPaths } from './_challengePaths'

describe('challengeStaticPaths', () => {
  it('builds no challenge route in production', () => {
    vi.stubEnv('VERCEL_ENV', 'production')

    expect(challengeStaticPaths()).toEqual([])
  })

  it('builds the English route at the root and the Chinese route under its prefix in previews', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')

    expect(challengeStaticPaths()).toStrictEqual([
      {
        params: { locale: undefined, view: undefined },
        props: { locale: 'en' }
      },
      {
        params: { locale: 'zh-CN', view: undefined },
        props: { locale: 'zh-CN' }
      }
    ])
  })
})
