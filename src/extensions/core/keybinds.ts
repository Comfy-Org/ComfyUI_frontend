import { app } from '../../scripts/app'
import { KeyComboImpl, useKeybindingStore } from '@/stores/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

app.registerExtension({
  name: 'Comfy.Keybinds',
  init() {
    const keybindListener = async function (event: KeyboardEvent) {
      // Ignore keybindings for legacy jest tests as jest tests don't have
      // a Vue app instance or pinia stores.
      if (!app.vueAppReady) return

      const keyCombo = KeyComboImpl.fromEvent(event)
      if (keyCombo.isModifier) {
        return
      }

      // Ignore non-modifier keybindings if typing in input fields
      const target = event.composedPath()[0] as HTMLElement
      if (
        !keyCombo.hasModifier &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          (target.tagName === 'SPAN' &&
            target.classList.contains('property_value')))
      ) {
        return
      }

      const keybindingStore = useKeybindingStore()
      const commandStore = useCommandStore()
      const keybinding = keybindingStore.getKeybinding(keyCombo)
      if (keybinding && keybinding.targetSelector !== '#graph-canvas') {
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

    window.addEventListener('keydown', keybindListener)
  }
})
