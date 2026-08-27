import type { APIContext } from 'astro'
import { describe, expect, it } from 'vitest'

import { GET } from './404.md'

describe('GET /404.md', () => {
  it('serves the 404 recovery markdown twin', async () => {
    const res = await GET({} as APIContext)
    const body = await res.text()
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(body.startsWith('# 404')).toBe(true)
  })
})
