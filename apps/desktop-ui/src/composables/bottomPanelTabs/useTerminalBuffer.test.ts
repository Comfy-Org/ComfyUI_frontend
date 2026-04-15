import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

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
import { useTerminalBuffer } from '@/composables/bottomPanelTabs/useTerminalBuffer'

function withSetup<T>(composable: () => T): T {
  let result!: T
  render(
    defineComponent({
      setup() {
        result = composable()
        return {}
      },
      template: '<div />'
    })
  )
  return result
}

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
      copyTo({ write: mockWrite } as unknown as Terminal)
      expect(mockWrite).toHaveBeenCalledWith('hello world')
    })

    it('writes empty string when buffer is empty', () => {
      mockSerialize.mockReturnValue('')
      const { copyTo } = withSetup(() => useTerminalBuffer())
      const mockWrite = vi.fn()
      copyTo({ write: mockWrite } as unknown as Terminal)
      expect(mockWrite).toHaveBeenCalledWith('')
    })
  })
})
