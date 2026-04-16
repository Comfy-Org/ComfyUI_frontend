import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSerialize, MockSerializeAddon } = vi.hoisted(() => {
  const mockSerialize = vi.fn<[], string>()
  const MockSerializeAddon = vi.fn(function () {
    return { serialize: mockSerialize }
  })
  return { mockSerialize, MockSerializeAddon }
})

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(function () {
    return { loadAddon: vi.fn(), dispose: vi.fn(), write: vi.fn() }
  })
}))

vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: MockSerializeAddon
}))

import type { Terminal } from '@xterm/xterm'
import { withSetup } from '@/test/withSetup'
import { useTerminalBuffer } from '@/composables/bottomPanelTabs/useTerminalBuffer'

describe('useTerminalBuffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSerialize.mockReturnValue('')
  })

  describe('copyTo', () => {
    it('writes serialized buffer content to the destination terminal', () => {
      mockSerialize.mockReturnValue('hello world')
      const { copyTo } = withSetup(() => useTerminalBuffer())
      const mockWrite = vi.fn()
      copyTo({ write: mockWrite } as Pick<Terminal, 'write'>)
      expect(mockWrite).toHaveBeenCalledWith('hello world')
    })

    it('writes empty string when buffer is empty', () => {
      mockSerialize.mockReturnValue('')
      const { copyTo } = withSetup(() => useTerminalBuffer())
      const mockWrite = vi.fn()
      copyTo({ write: mockWrite } as Pick<Terminal, 'write'>)
      expect(mockWrite).toHaveBeenCalledWith('')
    })
  })
})
