import { describe, expect, it } from 'vitest'

import { tPlural } from './translations'

describe('tPlural', () => {
  it('picks the singular form for one', () => {
    expect(tPlural('cloudNodesLaunch.models.nodeCount', 1, 'en')).toBe('1 node')
  })

  it('picks the plural form for other counts', () => {
    expect(tPlural('cloudNodesLaunch.models.nodeCount', 3, 'en')).toBe(
      '3 nodes'
    )
    expect(tPlural('cloudNodesLaunch.models.nodeCount', 0, 'en')).toBe(
      '0 nodes'
    )
  })

  it('uses the locale plural rules, not English ones', () => {
    expect(tPlural('cloudNodesLaunch.models.nodeCount', 1, 'zh-CN')).toBe(
      '1 个节点'
    )
    expect(tPlural('cloudNodesLaunch.models.nodeCount', 3, 'zh-CN')).toBe(
      '3 个节点'
    )
  })

  it('falls back to English plural rules when the locale has no translation', () => {
    // ja selects 'other' for 1, so using it on the English fallback would read
    // '1 nodes'.
    expect(tPlural('cloudNodesLaunch.models.nodeCount', 1, 'ja')).toBe('1 node')
    expect(tPlural('cloudNodesLaunch.models.nodeCount', 3, 'ja')).toBe(
      '3 nodes'
    )
  })

  it('returns a single-form message unchanged', () => {
    expect(tPlural('cloudNodesLaunch.models.flux2', 2, 'en')).toBe('Flux 2')
  })
})
