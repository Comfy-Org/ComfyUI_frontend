import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTerminalBridge, isTerminalHostAvailable } from './useTerminalBridge'

const electronAPIMock = vi.hoisted(() => vi.fn())
vi.mock('@/utils/envUtil', () => ({ electronAPI: electronAPIMock }))

describe('useTerminalBridge', () => {
  beforeEach(() => {
    electronAPIMock.mockReturnValue(undefined)
    delete window.__comfyDesktop2
  })

  afterEach(() => {
    delete window.__comfyDesktop2
    vi.clearAllMocks()
  })

  it('returns null when no terminal host is present (e.g. a browser tab)', () => {
    expect(getTerminalBridge()).toBeNull()
    expect(isTerminalHostAvailable()).toBe(false)
  })

  it('prefers the Desktop 2.0 host and exposes restart + exit notifications', () => {
    const launcher = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      restart: vi.fn(),
      onOutput: vi.fn(),
      onExited: vi.fn()
    }
    window.__comfyDesktop2 = { Terminal: launcher }

    const bridge = getTerminalBridge()
    expect(bridge).not.toBeNull()
    expect(bridge?.restart).not.toBeNull()
    expect(bridge?.onExited).not.toBeNull()

    void bridge?.write('ls\r')
    expect(launcher.write).toHaveBeenCalledWith('ls\r')
    expect(isTerminalHostAvailable()).toBe(true)
  })

  it('falls back to the legacy desktop host without restart/exit support', () => {
    const legacy = {
      write: vi.fn(),
      resize: vi.fn(),
      restore: vi
        .fn()
        .mockResolvedValue({ buffer: [], size: { cols: 80, rows: 30 } }),
      onOutput: vi.fn()
    }
    electronAPIMock.mockReturnValue({ Terminal: legacy })

    const bridge = getTerminalBridge()
    expect(bridge).not.toBeNull()
    // Legacy can't restart or report exits.
    expect(bridge?.restart).toBeNull()
    expect(bridge?.onExited).toBeNull()

    // subscribe() maps to the legacy restore().
    void bridge?.subscribe()
    expect(legacy.restore).toHaveBeenCalled()
  })

  it('uses Desktop 2.0 even when the legacy API is also present', () => {
    const launcher = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      restart: vi.fn(),
      onOutput: vi.fn(),
      onExited: vi.fn()
    }
    const legacy = {
      write: vi.fn(),
      resize: vi.fn(),
      restore: vi.fn(),
      onOutput: vi.fn()
    }
    window.__comfyDesktop2 = { Terminal: launcher }
    electronAPIMock.mockReturnValue({ Terminal: legacy })

    const bridge = getTerminalBridge()
    void bridge?.write('x')
    expect(launcher.write).toHaveBeenCalledWith('x')
    expect(legacy.write).not.toHaveBeenCalled()
  })
})
