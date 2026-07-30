import { render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useCommandStore } from '@/stores/commandStore'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => [])
  }))
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: null
  }
}))

const open = ref(false)

const RekaDialogHost = defineComponent({
  name: 'RekaDialogHost',
  setup: () => () =>
    h(
      Dialog,
      { open: open.value, 'onUpdate:open': (v: boolean) => (open.value = v) },
      () =>
        h(DialogPortal, null, () =>
          h(DialogContent, null, () => [
            h(DialogTitle, null, () => 'Reka dialog'),
            h(DialogDescription, null, () => 'Opened outside dialogStore')
          ])
        )
    )
})

/**
 * Exercises the real reka primitives rather than a hand-built DOM fixture, so
 * the `role="dialog"` / `data-state` signal the guard relies on is verified
 * against what reka actually renders.
 */
describe('keybindingService - reka dialog integration', () => {
  let keybindHandler: (event: KeyboardEvent) => Promise<void>
  let mockCommandExecute: ReturnType<typeof useCommandStore>['execute']

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    open.value = false

    const commandStore = useCommandStore()
    mockCommandExecute = vi.fn()
    commandStore.execute = mockCommandExecute

    const keybindingService = useKeybindingService()
    keybindingService.registerCoreKeybindings()
    keybindHandler = keybindingService.keybindHandler
    // GraphView binds the handler on mount, so it always precedes the
    // DismissableLayer listener a later-opened dialog installs.
    window.addEventListener('keydown', keybindHandler)
  })

  afterEach(() => {
    window.removeEventListener('keydown', keybindHandler)
  })

  function pressKey(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true
    })
    // eslint-disable-next-line testing-library/no-node-access -- reka focus-traps into DialogContent, so a real keypress originates inside the dialog
    ;(document.activeElement ?? document.body).dispatchEvent(event)
    return event
  }

  it('runs the Escape command when no reka dialog is open', async () => {
    render(RekaDialogHost)

    pressKey('Escape')

    await waitFor(() =>
      expect(mockCommandExecute).toHaveBeenCalledWith(
        'Comfy.Graph.ExitSubgraph'
      )
    )
  })

  it('executes a global keybinding while a real reka popover is open', async () => {
    const PopoverHost = defineComponent({
      name: 'PopoverHost',
      setup: () => () =>
        h(Popover, { open: true }, () =>
          h(PopoverContent, null, () => 'Popover body')
        )
    })
    render(PopoverHost)
    const popover = await screen.findByRole('dialog')
    expect(popover.getAttribute('data-state')).toBe('open')

    // Probed with a plain key, not Escape: Escape would also assert that reka's
    // own popover dismissal stays suppressed, which is not this guard's contract.
    pressKey('w')

    await waitFor(() =>
      expect(mockCommandExecute).toHaveBeenCalledWith(
        'Workspace.ToggleSidebarTab.workflows'
      )
    )
  })

  it('lets reka close its dialog on Escape without exiting the subgraph', async () => {
    render(RekaDialogHost)
    open.value = true
    const dialog = await screen.findByRole('dialog')
    expect(dialog.getAttribute('data-state')).toBe('open')

    const event = pressKey('Escape')

    expect(event.defaultPrevented).toBe(false)
    expect(mockCommandExecute).not.toHaveBeenCalled()
    await waitFor(() => expect(open.value).toBe(false))
  })
})
