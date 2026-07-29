import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'

import { CORE_KEYBINDINGS } from './defaults'
import { KeyComboImpl } from './keyCombo'
import { KeybindingImpl } from './keybinding'
import { useKeybindingStore } from './keybindingStore'

const OPEN_REKA_CONTENT_SELECTOR = '[role="dialog"][data-state="open"]'
const POPPER_WRAPPER_SELECTOR = '[data-reka-popper-content-wrapper]'

/**
 * Reka marks open dialog content with `role="dialog"`, but reuses that role for
 * `PopoverContent`, which is non-modal and must keep global keybindings
 * working. Only popover content is positioned inside a popper wrapper.
 */
function isDialogContent(content: Element): boolean {
  return content.closest(POPPER_WRAPPER_SELECTOR) === null
}

/**
 * Dialogs built directly on reka's `DialogRoot` never register with
 * `dialogStore`, so its stack cannot see them.
 */
function hasOpenRekaDialog(): boolean {
  return Array.from(document.querySelectorAll(OPEN_REKA_CONTENT_SELECTOR)).some(
    isDialogContent
  )
}

/**
 * Whether the event originated inside the open dialog rather than a popover
 * layered over it, so dialog-scoped shortcuts fire while background commands
 * pressed inside a popover stay suppressed.
 */
function isTargetInDialog(target: HTMLElement): boolean {
  const content = target.closest?.('[role="dialog"]')
  return content != null && isDialogContent(content)
}

export function useKeybindingService() {
  const keybindingStore = useKeybindingStore()
  const commandStore = useCommandStore()
  const settingStore = useSettingStore()
  const dialogStore = useDialogStore()

  async function keybindHandler(event: KeyboardEvent) {
    const keyCombo = KeyComboImpl.fromEvent(event)
    if (keyCombo.isModifier) {
      return
    }

    const target = event.composedPath()[0] as HTMLElement
    if (
      keyCombo.isReservedByTextInput &&
      (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.contentEditable === 'true' ||
        (target.tagName === 'SPAN' &&
          target.classList.contains('property_value')))
    ) {
      return
    }

    const keybinding = keybindingStore.getKeybinding(keyCombo)
    if (keybinding) {
      const targetElementId =
        keybinding.targetElementId === 'graph-canvas'
          ? 'graph-canvas-container'
          : keybinding.targetElementId
      if (targetElementId) {
        const container = document.getElementById(targetElementId)
        if (!container?.contains(target)) {
          return
        }
      }
      /**
       * Block global keybindings from triggering background actions while a
       * dialog is open. Keybindings whose event target lives inside an open
       * dialog still fire, so dialog-scoped shortcuts keep working. Escape is
       * the exception: it belongs to the dialog, and must also skip the
       * `preventDefault()` below, since reka dismisses its own dialogs only
       * while the event is not already default-prevented.
       */
      if (dialogStore.dialogStack.length > 0 || hasOpenRekaDialog()) {
        if (
          event.key === 'Escape' &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          !event.shiftKey
        ) {
          return
        }
        if (!isTargetInDialog(target)) {
          return
        }
      }

      event.preventDefault()
      const runCommandIds = new Set([
        'Comfy.QueuePrompt',
        'Comfy.QueuePromptFront',
        'Comfy.QueueSelectedOutputNodes'
      ])
      if (runCommandIds.has(keybinding.commandId)) {
        await commandStore.execute(keybinding.commandId, {
          metadata: {
            trigger_source: 'keybinding'
          }
        })
      } else {
        await commandStore.execute(keybinding.commandId)
      }
      return
    }

    if (event.ctrlKey || event.altKey || event.metaKey) {
      return
    }

    if (event.key === 'Escape') {
      const modals = document.querySelectorAll<HTMLElement>('.comfy-modal')
      for (const modal of modals) {
        const modalDisplay = window
          .getComputedStyle(modal)
          .getPropertyValue('display')

        if (modalDisplay !== 'none') {
          modal.style.display = 'none'
          break
        }
      }

      for (const d of document.querySelectorAll('dialog')) d.close()
    }
  }

  function registerCoreKeybindings() {
    for (const keybinding of CORE_KEYBINDINGS) {
      if (
        isCloud &&
        keybinding.commandId === 'Workspace.ToggleBottomPanelTab.logs-terminal'
      ) {
        continue
      }
      keybindingStore.addDefaultKeybinding(new KeybindingImpl(keybinding))
    }
  }

  function registerUserKeybindings() {
    const unsetBindings = settingStore.get('Comfy.Keybinding.UnsetBindings')
    for (const keybinding of unsetBindings) {
      if (!commandStore.isRegistered(keybinding.commandId)) {
        continue
      }
      keybindingStore.unsetKeybinding(new KeybindingImpl(keybinding))
    }
    const newBindings = settingStore.get('Comfy.Keybinding.NewBindings')
    for (const keybinding of newBindings) {
      if (
        isCloud &&
        keybinding.commandId === 'Workspace.ToggleBottomPanelTab.logs-terminal'
      ) {
        continue
      }
      keybindingStore.addUserKeybinding(new KeybindingImpl(keybinding))
    }
  }

  async function persistUserKeybindings() {
    await settingStore.setMany({
      'Comfy.Keybinding.NewBindings': Object.values(
        keybindingStore.getUserKeybindings()
      ),
      'Comfy.Keybinding.UnsetBindings': Object.values(
        keybindingStore.getUserUnsetKeybindings()
      )
    })
  }

  return {
    keybindHandler,
    registerCoreKeybindings,
    registerUserKeybindings,
    persistUserKeybindings
  }
}
