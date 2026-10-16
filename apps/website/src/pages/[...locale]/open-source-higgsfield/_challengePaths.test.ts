import { describe, expect, it, vi } from 'vitest'

import { challengeStaticPaths } from './_challengePaths'

describe('challengeStaticPaths', () => {
  it.for(['production', 'preview'])(
    'builds the English route at the root and the Chinese route under its prefix in %s',
    (env) => {
      vi.stubEnv('VERCEL_ENV', env)

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
    }
  )
})
