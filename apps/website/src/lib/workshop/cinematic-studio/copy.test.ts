import { describe, expect, it } from 'vitest'

import { tc } from './copy'

describe('tc', () => {
  it('fills named values in the locale word order', () => {
    expect(
      tc('cinematic.stage.takeName', 'zh-CN', { shot: 2, take: 'B' })
    ).toBe('镜头 2，第 B 条')
  })
})
