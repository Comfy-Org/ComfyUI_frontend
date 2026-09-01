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
    target: HTMLElement = document.body,
    modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...modifiers
    })
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

  it('does NOT execute a global keybinding from inside an open dialog', async () => {
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

      expect(mockCommandExecute).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    } finally {
      document.body.removeChild(dialog)
    }
  })

  it('does NOT execute a global keybinding while a local modal is open', async () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialog)

    try {
      const event = createKeyboardEvent('w')
      await keybindingService.keybindHandler(event)

      expect(mockCommandExecute).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    } finally {
      document.body.removeChild(dialog)
    }
  })

  it('executes Ctrl+S while an ARIA modal is hidden', async () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.hidden = true
    document.body.appendChild(dialog)

    try {
      const event = createKeyboardEvent('s', document.body, { ctrlKey: true })
      await keybindingService.keybindHandler(event)

      expect(mockCommandExecute).toHaveBeenCalledWith('Comfy.SaveWorkflow')
      expect(event.defaultPrevented).toBe(true)
    } finally {
      document.body.removeChild(dialog)
    }
  })

  it('does NOT execute a global keybinding while a reka dialog is open', async () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    document.body.appendChild(dialog)

    try {
      const event = createKeyboardEvent('w')
      await keybindingService.keybindHandler(event)

      expect(mockCommandExecute).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    } finally {
      document.body.removeChild(dialog)
    }
  })

  it.for([
    { label: 'Ctrl+S', modifiers: { ctrlKey: true } },
    { label: 'Meta+S', modifiers: { metaKey: true } }
  ] as {
    label: string
    modifiers: { ctrlKey?: boolean; metaKey?: boolean }
  }[])(
    'still suppresses the browser default for $label while a dialog is open',
    async ({ modifiers }) => {
      const dialogStore = useDialogStore()
      dialogStore.dialogStack.push(createTestDialogInstance('templates-dialog'))

      const event = createKeyboardEvent('s', document.body, modifiers)
      await keybindingService.keybindHandler(event)

      expect(mockCommandExecute).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(true)
    }
  )

  it('executes a global keybinding while a reka popover is open', async () => {
    const popper = document.createElement('div')
    popper.setAttribute('data-reka-popper-content-wrapper', '')
    const popover = document.createElement('div')
    popover.setAttribute('role', 'dialog')
    popover.setAttribute('data-state', 'open')
    popper.appendChild(popover)
    document.body.appendChild(popper)

    try {
      const event = createKeyboardEvent('w')
      await keybindingService.keybindHandler(event)

      expect(mockCommandExecute).toHaveBeenCalledWith(
        'Workspace.ToggleSidebarTab.workflows'
      )
    } finally {
      document.body.removeChild(popper)
    }
  })
})
