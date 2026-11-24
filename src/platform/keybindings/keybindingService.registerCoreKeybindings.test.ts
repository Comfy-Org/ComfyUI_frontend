import { describe, expect, it, vi } from 'vitest'

import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: null
  }
}))

describe('keybindingService - registerCoreKeybindings', () => {
  it('can run again when GraphView remounts', () => {
    const keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
    const registered = useKeybindingStore().keybindings.length

    expect(() => keybindingService.registerCoreKeybindings()).not.toThrow()
    expect(useKeybindingStore().keybindings).toHaveLength(registered)
  })
})
