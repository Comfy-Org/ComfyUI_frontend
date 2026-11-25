import { describe, expect, it } from 'vitest'

import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'

describe('keybindingService - registerCoreKeybindings', () => {
  it('can run again when GraphView remounts', () => {
    const keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
    const registered = useKeybindingStore().keybindings.length

    expect(() => keybindingService.registerCoreKeybindings()).not.toThrow()
    expect(useKeybindingStore().keybindings).toHaveLength(registered)
  })
})
