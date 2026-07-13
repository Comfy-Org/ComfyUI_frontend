import { describe, expect, it } from 'vitest'

import type { DeprecationEntry } from '../src/platform/dev/deprecations'
import { renderDeprecationsMdx } from './generate-deprecations-doc'

const SAMPLE: Record<string, DeprecationEntry> = {
  'b.thing': {
    source: 'beta',
    message: 'thing is deprecated.',
    suggestion: 'Use otherThing.',
    since: '1.0',
    removeBy: '2.0',
    docsUrl: 'https://docs.example/thing'
  },
  'a.first': {
    source: 'alpha',
    message: 'first is gone.'
  },
  'a.second': {
    source: 'alpha',
    message: 'second is gone | really.'
  }
}

describe('renderDeprecationsMdx', () => {
  const mdx = renderDeprecationsMdx(SAMPLE)

  it('emits Mintlify frontmatter', () => {
    expect(mdx.startsWith('---\ntitle: "Deprecations"')).toBe(true)
  })

  it('includes an intro explaining the deprecation policy before the tables', () => {
    expect(mdx).toContain('Whilst we try to keep the frontend API stable')
    expect(mdx.indexOf('Whilst we try')).toBeLessThan(mdx.indexOf('## alpha'))
  })

  it('documents the dev-mode-gated Deprecation Warnings panel', () => {
    expect(mdx).toContain('## Deprecation Warnings panel')
    expect(mdx).toContain('dev mode')
  })

  it('groups entries by source, sorted alphabetically', () => {
    expect(mdx.indexOf('## alpha')).toBeLessThan(mdx.indexOf('## beta'))
  })

  it('renders a row per entry with replacement, version and docs columns', () => {
    expect(mdx).toContain(
      '| thing is deprecated. | Use otherThing. | 1.0 | 2.0 | [Guide](https://docs.example/thing) |'
    )
  })

  it('uses a dash for missing optional fields', () => {
    expect(mdx).toContain('| first is gone. | - | - | - | - |')
  })

  it('escapes pipe characters so the table is not broken', () => {
    expect(mdx).toContain('second is gone \\| really.')
  })

  it('omits optional columns when no entry anywhere has a value', () => {
    const minimal = renderDeprecationsMdx({
      'a.first': { source: 'alpha', message: 'first is gone.' },
      'a.second': { source: 'alpha', message: 'second is gone.' }
    })

    expect(minimal).toContain('| Deprecated | Replacement |')
    expect(minimal).not.toContain('Since')
    expect(minimal).not.toContain('Removed in')
    expect(minimal).not.toContain('Docs')
  })

  it('keeps a column when at least one entry in any table has a value', () => {
    const mixed = renderDeprecationsMdx({
      'a.first': { source: 'alpha', message: 'first is gone.' },
      'b.second': { source: 'beta', message: 'second is gone.', since: '1.0' }
    })

    expect(mixed).toContain('| Deprecated | Replacement | Since |')
    expect(mixed).not.toContain('Removed in')
  })
})
