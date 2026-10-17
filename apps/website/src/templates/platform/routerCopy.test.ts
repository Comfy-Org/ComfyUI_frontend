import { describe, expect, it } from 'vitest'

import { routerFaq } from './routerCopy'

describe('routerFaq', () => {
  it('names every serving provider in the direct-call question', () => {
    expect(routerFaq('en')[0].question).toBe(
      'Why not call fal, Higgsfield, Pika, Runware, or WaveSpeed directly?'
    )
  })

  it('leaves no placeholder unfilled in any locale', () => {
    for (const locale of ['en', 'zh-CN', 'ja'] as const)
      for (const { question } of routerFaq(locale))
        expect(question).not.toContain('{providers}')
  })
})
