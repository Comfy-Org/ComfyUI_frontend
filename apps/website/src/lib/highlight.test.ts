import { describe, expect, it } from 'vitest'

import { highlightInline } from './highlight'

describe('highlightInline', () => {
  it('returns tokenized spans without a wrapper element', async () => {
    const html = await highlightInline('{ "gpu": "H100" }', 'json')

    expect(html).toContain('<span')
    expect(html).not.toContain('<pre')
    expect(html).toContain('H100')
  })

  it('loads each supported grammar on demand', async () => {
    for (const lang of ['javascript', 'python', 'shell'] as const) {
      expect(await highlightInline('echo hi', lang)).toContain('<span')
    }
  })

  it('skips highlighting for oversized payloads', async () => {
    expect(await highlightInline('x'.repeat(129 * 1024), 'json')).toBeNull()
  })
})
