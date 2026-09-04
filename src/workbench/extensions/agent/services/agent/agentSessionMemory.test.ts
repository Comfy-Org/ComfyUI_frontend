import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import {
  AGENT_THREAD_STORAGE_KEY,
  forgetAgentSessionMemory,
  readAgentSessionMemory,
  rememberAgentSessionMemory
} from './agentSessionMemory'

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

describe('agentSessionMemory', () => {
  beforeEach(() => localStorage.clear())

  it('treats unavailable storage as empty and reports the failure', () => {
    const error = new Error('storage disabled')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw error
    })

    expect(readAgentSessionMemory('user-a')).toBeNull()
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'agent_session_memory_storage_failure'
    })
  })

  it('does not throw when storage writes and removals fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('write disabled')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove disabled')
    })

    expect(() => rememberAgentSessionMemory('thread-a', 'user-a')).not.toThrow()
    expect(() => forgetAgentSessionMemory()).not.toThrow()
    expect(reportError).toHaveBeenCalledTimes(3)
    expect(localStorage.getItem(AGENT_THREAD_STORAGE_KEY)).toBeNull()
  })

  it('restores the previous thread when the owner update fails', () => {
    localStorage.setItem(AGENT_THREAD_STORAGE_KEY, 'thread-a')
    localStorage.setItem('Comfy.Agent.ThreadOwnerId', 'user-a')
    const setItem = Storage.prototype.setItem
    let writes = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      key,
      value
    ) {
      writes++
      if (writes === 2) throw new Error('owner write failed')
      setItem.call(this, key, value)
    })

    rememberAgentSessionMemory('thread-b', 'user-b')

    expect(localStorage.getItem(AGENT_THREAD_STORAGE_KEY)).toBe('thread-a')
    expect(localStorage.getItem('Comfy.Agent.ThreadOwnerId')).toBe('user-a')
  })
})
