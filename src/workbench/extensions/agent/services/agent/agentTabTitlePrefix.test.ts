import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

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

  it('clears a held prefix when its clear signal fires, and stops listening after', () => {
    const listeners = new Set<() => void>()
    const clearOn = (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
    setAgentTabTitlePrefix('Input needed')
    holdAgentTabTitlePrefixUntil(Date.now() + 60_000, clearOn)

    listeners.forEach((listener) => listener())

    expect(useBrowserTabTitleStore().prefix).toBe('')
    expect(listeners.size).toBe(0)
  })

  it('stops listening for the clear signal once a later write takes over', () => {
    const listeners = new Set<() => void>()
    setAgentTabTitlePrefix('Input needed')
    holdAgentTabTitlePrefixUntil(Date.now() + 60_000, (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    })

    setAgentTabTitlePrefix('Input needed')

    expect(listeners.size).toBe(0)
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

  describe('Desktop attention', () => {
    const setAttentionNeeded = vi.fn<(needed: boolean) => void>()

    beforeEach(() => {
      setAgentTabTitlePrefix(null)
      vi.stubGlobal('__comfyDesktop2', { setAttentionNeeded })
    })

    it('asks Desktop for the user while the prefix shows, and stops when it clears', () => {
      setAgentTabTitlePrefix('Input needed')
      setAgentTabTitlePrefix(null)

      expect(setAttentionNeeded.mock.calls).toEqual([[true], [false]])
    })

    it('keeps asking through a hold and stops when the hold clears', () => {
      setAgentTabTitlePrefix('Input needed')
      holdAgentTabTitlePrefixUntil(Date.now() + 60_000)
      expect(setAttentionNeeded).toHaveBeenLastCalledWith(true)

      vi.advanceTimersByTime(60_000)

      expect(setAttentionNeeded).toHaveBeenLastCalledWith(false)
    })

    it('does not fail on a Desktop build without the bridge member', () => {
      vi.stubGlobal('__comfyDesktop2', {})

      setAgentTabTitlePrefix('Input needed')

      expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')
      expect(reportError).not.toHaveBeenCalled()
    })

    it('keeps the tab title working and reports a warning when the bridge call throws', () => {
      const failure = new Error('ipc gone')
      setAttentionNeeded.mockImplementationOnce(() => {
        throw failure
      })

      setAgentTabTitlePrefix('Input needed')

      expect(useBrowserTabTitleStore().prefix).toBe('[Input needed] ')
      expect(reportError).toHaveBeenCalledWith(failure, {
        surface: 'agent',
        errorType: 'failure_setting_desktop_attention',
        level: 'warning'
      })
    })
  })
})
