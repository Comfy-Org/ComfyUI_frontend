import { createPinia, setActivePinia } from 'pinia'
import { markRaw, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/**
 * Mirrors what reka renders for open `DialogContent`: `role="dialog"` plus
 * `data-state`, portaled to the body and never registered with `dialogStore`.
 */
function appendRekaDialog(state: 'open' | 'closed' = 'open'): HTMLElement {
  const content = document.createElement('div')
  content.setAttribute('role', 'dialog')
  content.setAttribute('data-state', state)
  document.body.appendChild(content)
  return content
}

/**
 * Reka gives `PopoverContent` the same `role`/`data-state` pair as a dialog,
 * distinguished only by the popper wrapper it is positioned inside.
 */
function appendRekaPopover(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-reka-popper-content-wrapper', '')
  const content = document.createElement('div')
  content.setAttribute('role', 'dialog')
  content.setAttribute('data-state', 'open')
  wrapper.appendChild(content)
  document.body.appendChild(wrapper)
  return content
}

describe('keybindingService - dialog gate', () => {
  let keybindingService: ReturnType<typeof useKeybindingService>
  let mockCommandExecute: ReturnType<typeof useCommandStore>['execute']

  afterEach(() => {
    document.body.replaceChildren()
  })

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

  it('does NOT execute a global keybinding while a reka dialog is open', async () => {
    appendRekaDialog()

    const event = createKeyboardEvent('w')
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).not.toHaveBeenCalled()
  })

  it('does NOT execute the Escape keybinding while a reka dialog is open', async () => {
    const dialog = appendRekaDialog()
    const inner = document.createElement('button')
    dialog.appendChild(inner)

    const event = createKeyboardEvent('Escape', inner)
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).not.toHaveBeenCalled()
  })

  it('leaves Escape un-prevented so reka can dismiss its own dialog', async () => {
    const dialog = appendRekaDialog()
    const inner = document.createElement('button')
    dialog.appendChild(inner)

    // Targeted inside the dialog: from outside, the containment check below
    // the Escape branch would satisfy this assertion on its own.
    const event = createKeyboardEvent('Escape', inner)
    await keybindingService.keybindHandler(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('still executes a keybinding whose target lives inside the open reka dialog', async () => {
    const dialog = appendRekaDialog()
    const inner = document.createElement('button')
    dialog.appendChild(inner)

    const event = createKeyboardEvent('w', inner)
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).toHaveBeenCalledWith(
      'Workspace.ToggleSidebarTab.workflows'
    )
  })

  it('executes a global keybinding while a reka popover is open', async () => {
    appendRekaPopover()

    const event = createKeyboardEvent('w')
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).toHaveBeenCalledWith(
      'Workspace.ToggleSidebarTab.workflows'
    )
  })

  it('executes a global keybinding once a reka dialog has closed', async () => {
    appendRekaDialog('closed')

    const event = createKeyboardEvent('w')
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).toHaveBeenCalledWith(
      'Workspace.ToggleSidebarTab.workflows'
    )
  })

  it('does NOT execute the Escape keybinding while a store dialog is open', async () => {
    const dialogStore = useDialogStore()
    dialogStore.dialogStack.push(createTestDialogInstance('templates-dialog'))

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const inner = document.createElement('button')
    dialog.appendChild(inner)
    document.body.appendChild(dialog)

    const event = createKeyboardEvent('Escape', inner)
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('does NOT execute a global keybinding targeted inside a popover layered over an open dialog', async () => {
    appendRekaDialog()
    const popover = appendRekaPopover()
    const inner = document.createElement('button')
    popover.appendChild(inner)

    const event = createKeyboardEvent('w', inner)
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).not.toHaveBeenCalled()
  })

  it('blocks a global keybinding when a popover precedes the open dialog', async () => {
    appendRekaPopover()
    appendRekaDialog()

    const event = createKeyboardEvent('w')
    await keybindingService.keybindHandler(event)

    expect(mockCommandExecute).not.toHaveBeenCalled()
  })
})
