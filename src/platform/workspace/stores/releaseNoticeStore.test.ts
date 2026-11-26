import { describe, expect, it } from 'vitest'

import { useReleaseNoticeStore } from './releaseNoticeStore'

describe('useReleaseNoticeStore', () => {
  it('lets one notice claim a version, once', () => {
    const store = useReleaseNoticeStore()

    expect(store.claim('r-2')).toBe(true)
    expect(store.claim('r-2')).toBe(false)
  })

  it('keeps each version apart', () => {
    const store = useReleaseNoticeStore()

    expect(store.claim('r-2')).toBe(true)
    expect(store.claim('r-3')).toBe(true)
  })
})
