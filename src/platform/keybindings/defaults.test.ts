import { describe, expect, it } from 'vitest'

import { CORE_KEYBINDINGS } from '@/platform/keybindings/defaults'

describe('CORE_KEYBINDINGS', () => {
  it('should include Workspace.ToggleFocusMode bound to Ctrl+Shift+F', () => {
    const binding = CORE_KEYBINDINGS.find(
      (kb) => kb.commandId === 'Workspace.ToggleFocusMode'
    )

    expect(binding).toBeDefined()
    expect(binding!.combo).toEqual({
      key: 'f',
      ctrl: true,
      shift: true
    })
  })
})
