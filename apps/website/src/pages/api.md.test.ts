import type { APIContext } from 'astro'
import { describe, expect, it } from 'vitest'

import { GET } from './api.md'

describe('GET /api.md', () => {
  it('serves the API page markdown twin', async () => {
    const res = await GET({} as APIContext)
    const body = await res.text()
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(body.startsWith('# Comfy API — ')).toBe(true)
  })
})
