import { describe, expect, it } from 'vitest'

import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'

const options = {
  emptyLabel: '(empty)',
  untitledLabel: '(untitled)',
  st: (_key: string, fallback: string) => fallback
}

describe('resolveNodeDisplayName', () => {
  it('returns emptyLabel for null node', () => {
    expect(resolveNodeDisplayName(null, options)).toBe('(empty)')
  })

  it('returns emptyLabel for undefined node', () => {
    expect(resolveNodeDisplayName(undefined, options)).toBe('(empty)')
  })

  it('returns title when present', () => {
    expect(
      resolveNodeDisplayName({ title: 'My Node', type: 'KSampler' }, options)
    ).toBe('My Node')
  })

  it('returns type via st() when title is empty', () => {
    expect(
      resolveNodeDisplayName({ title: '', type: 'KSampler' }, options)
    ).toBe('KSampler')
  })

  it('returns untitledLabel when both title and type are empty', () => {
    expect(resolveNodeDisplayName({ title: '', type: '' }, options)).toBe(
      '(untitled)'
    )
  })

  it('handles numeric title by converting to string', () => {
    expect(resolveNodeDisplayName({ title: 42 }, options)).toBe('42')
  })

  it('handles null title and null type', () => {
    expect(resolveNodeDisplayName({ title: null, type: null }, options)).toBe(
      '(untitled)'
    )
  })

  it('trims whitespace from title', () => {
    expect(resolveNodeDisplayName({ title: '  ' }, options)).toBe('(untitled)')
  })

  it('passes normalized i18n key to st function', () => {
    const keys: string[] = []
    const trackingSt = (key: string, fallback: string) => {
      keys.push(key)
      return fallback
    }
    resolveNodeDisplayName(
      { title: '', type: 'Some.Node' },
      { ...options, st: trackingSt }
    )
    expect(keys[0]).toBe('nodeDefs.Some_Node.display_name')
  })
})
