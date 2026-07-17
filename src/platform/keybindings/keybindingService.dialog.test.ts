import { createPinia, setActivePinia } from 'pinia'
import { markRaw, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useCommandStore } from '@/stores/commandStore'
import type { DialogInstance } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'

function createTestDialogInstance(
  key: string,
  overrides: Partial<DialogInstance> = {}
): DialogInstance {
  return {
    key,
    visible: true,
    component: markRaw({ template: '<div />' }),
    contentProps: {},
    dialogComponentProps: {},
    priority: 0,
    ...overrides
  }
}

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => [])
  }))
}))

vi.mock('@/stores/dialogStore', () => {
  const dialogStack = reactive<DialogInstance[]>([])
  return {
    useDialogStore: () => ({ dialogStack })
  }
})

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: null
  }
}))

describe('keybindingService - dialog gate', () => {
  let keybindingService: ReturnType<typeof useKeybindingService>
  let mockCommandExecute: ReturnType<typeof useCommandStore>['execute']

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    const commandStore = useCommandStore()
    mockCommandExecute = vi.fn()
    commandStore.execute = mockCommandExecute

    const dialogStore = useDialogStore()
    dialogStore.dialogStack.length = 0

    keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
  })

  function createKeyboardEvent(
    key: string,
    target: HTMLElement = document.body
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true
    })
    event.preventDefault = vi.fn()
    event.composedPath = vi.fn(() => [target])
    return event
  }

  it('executes a global keybinding when no dialog is open', async () => {
    const event = createKeyboardEvent('w')
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).toHaveBeenCalledWith(
      'Workspace.ToggleSidebarTab.workflows'
    )
  })

  it('does NOT execute a global keybinding while a dialog is open', async () => {
    const dialogStore = useDialogStore()
    dialogStore.dialogStack.push(createTestDialogInstance('templates-dialog'))

    const event = createKeyboardEvent('w')
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).not.toHaveBeenCalled()
  })

  it('still executes a keybinding whose target lives inside the open dialog', async () => {
    const dialogStore = useDialogStore()
    dialogStore.dialogStack.push(createTestDialogInstance('templates-dialog'))

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const inner = document.createElement('button')
    dialog.appendChild(inner)
    document.body.appendChild(dialog)

    try {
      const event = createKeyboardEvent('w', inner)
      await keybindingService.keybindHandler(event)

      expect(mockCommandExecute).toHaveBeenCalledWith(
        'Workspace.ToggleSidebarTab.workflows'
      )
    } finally {
      document.body.removeChild(dialog)
    }
  })
})
