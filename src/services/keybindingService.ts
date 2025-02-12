import { CORE_KEYBINDINGS } from '@/constants/coreKeybindings'
import { useCommandStore } from '@/stores/commandStore'
import {
  KeyComboImpl,
  KeybindingImpl,
  useKeybindingStore
} from '@/stores/keybindingStore'
import { useSettingStore } from '@/stores/settingStore'

export const useKeybindingService = () => {
  const keybindingStore = useKeybindingStore()
  const commandStore = useCommandStore()
  const settingStore = useSettingStore()

  const keybindHandler = async function (event: KeyboardEvent) {
    const keyCombo = KeyComboImpl.fromEvent(event)
    if (keyCombo.isModifier) {
      return
    }

    // Ignore reserved or non-modifier keybindings if typing in input fields
    const target = event.composedPath()[0] as HTMLElement
    if (
      keyCombo.isReservedByTextInput &&
      (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        (target.tagName === 'SPAN' &&
          target.classList.contains('property_value')))
    ) {
      return
    }

    const keybinding = keybindingStore.getKeybinding(keyCombo)
    if (keybinding && keybinding.targetElementId !== 'graph-canvas') {
      // Prevent default browser behavior first, then execute the command
      event.preventDefault()
      await commandStore.execute(keybinding.commandId)
      return
    }

    // Only clear dialogs if not using modifiers
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return
    }

    // Escape key: close the first open modal found, and all dialogs
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

  const registerCoreKeybindings = () => {
    for (const keybinding of CORE_KEYBINDINGS) {
      keybindingStore.addDefaultKeybinding(new KeybindingImpl(keybinding))
    }
  }

  function registerUserKeybindings() {
    // Unset bindings first as new bindings might conflict with default bindings.
    const unsetBindings = settingStore.get('Comfy.Keybinding.UnsetBindings')
    for (const keybinding of unsetBindings) {
      keybindingStore.unsetKeybinding(new KeybindingImpl(keybinding))
    }
    const newBindings = settingStore.get('Comfy.Keybinding.NewBindings')
    for (const keybinding of newBindings) {
      keybindingStore.addUserKeybinding(new KeybindingImpl(keybinding))
    }
  }

  async function persistUserKeybindings() {
    // TODO(https://github.com/Comfy-Org/ComfyUI_frontend/issues/1079):
    // Allow setting multiple values at once in settingStore
    await settingStore.set(
      'Comfy.Keybinding.NewBindings',
      Object.values(keybindingStore.getUserKeybindings())
    )
    await settingStore.set(
      'Comfy.Keybinding.UnsetBindings',
      Object.values(keybindingStore.getUserUnsetKeybindings())
    )
  }

  return {
    keybindHandler,
    registerCoreKeybindings,
    registerUserKeybindings,
    persistUserKeybindings
  }
}
