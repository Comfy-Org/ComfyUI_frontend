import { describe, expect, it } from 'vitest'

import { rc } from './reshoot-copy'

describe('rc', () => {
  it.for([
    { locale: 'en', expected: '48 frames at 24 fps (2.0 s)' },
    { locale: 'zh-CN', expected: '48 帧，24 fps（2.0 秒）' }
  ] as const)(
    'fills named values in the $locale word order',
    ({ locale, expected }) => {
      expect(rc('reshoot.frames', locale, { frames: 48, seconds: '2.0' })).toBe(
        expected
      )
    }
  )
})
