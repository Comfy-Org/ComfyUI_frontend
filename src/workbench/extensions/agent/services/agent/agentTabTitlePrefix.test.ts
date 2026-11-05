import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBrowserTabTitleStore } from '@/stores/browserTabTitleStore'

import {
  holdAgentTabTitlePrefixUntil,
  setAgentTabTitlePrefix
} from './agentTabTitlePrefix'

describe('agentTabTitlePrefix', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 })
  })

  afterEach(() => {
    setAgentTabTitlePrefix(null)
  })

  it('keeps a held prefix until its deadline, then clears it', () => {
    setAgentTabTitlePrefix('Input needed')

    holdAgentTabTitlePrefixUntil(Date.now() + 60_000)
    vi.advanceTimersByTime(59_999)
    expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')

    vi.advanceTimersByTime(1)
    expect(useBrowserTabTitleStore().prefix).toBe('')
  })

  it('clears at once when the deadline has already passed', () => {
    setAgentTabTitlePrefix('Input needed')

    holdAgentTabTitlePrefixUntil(Date.now())

    expect(useBrowserTabTitleStore().prefix).toBe('')
  })

  it('lets a later write replace the hold so its deadline cannot clear the new prefix', () => {
    setAgentTabTitlePrefix('Input needed')
    holdAgentTabTitlePrefixUntil(Date.now() + 60_000)

    setAgentTabTitlePrefix(null)
    setAgentTabTitlePrefix('Input needed')
    vi.advanceTimersByTime(60_000)

    expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')
  })

  it('replaces an earlier hold with the latest deadline', () => {
    setAgentTabTitlePrefix('Input needed')
    holdAgentTabTitlePrefixUntil(Date.now() + 10_000)
    holdAgentTabTitlePrefixUntil(Date.now() + 60_000)

    vi.advanceTimersByTime(10_000)
    expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')

    vi.advanceTimersByTime(50_000)
    expect(useBrowserTabTitleStore().prefix).toBe('')
  })
})
