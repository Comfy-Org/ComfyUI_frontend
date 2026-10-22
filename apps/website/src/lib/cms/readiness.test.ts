import { describe, expect, it } from 'vitest'

import { readinessGaps } from '@/lib/cms/readiness'

const record = (kind: 'MODEL' | 'WORKFLOW', data: Record<string, unknown>) => ({
  kind,
  slug: '/hub/models/demo',
  data: { href: '/hub/models/demo/', ...data }
})

describe('readinessGaps', () => {
  it('lists what a bare model is missing', () => {
    expect(readinessGaps(record('MODEL', { name: ' ' }))).toEqual([
      'page',
      'name',
      'summary',
      'cover',
      'examples'
    ])
  })

  it('accepts a cover from either field and asks examples only of models', () => {
    const gaps = readinessGaps(
      record('WORKFLOW', {
        name: 'Demo',
        summary: 'A demo',
        thumbnail: { url: 'https://media.comfy.org/a.webp', kind: 'image' }
      })
    )
    expect(gaps).not.toContain('cover')
    expect(gaps).not.toContain('examples')
    expect(
      readinessGaps(
        record('MODEL', { thumbnailUrl: 'https://media.comfy.org/a.webp' })
      )
    ).not.toContain('cover')
  })
})
