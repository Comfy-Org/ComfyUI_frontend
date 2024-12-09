import { app } from '../../scripts/app'
import { KeyComboImpl, useKeybindingStore } from '@/stores/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

//this class is responsible for handling key events and executing commands
class KeyboardManager {
  private modifiers: string[] = []
  private context: string = 'global'

  constructor() {
    this.addListeners()
  }

  addListeners() {
    window.addEventListener('keydown', (event) => this.handleKeyDown(event))
    window.addEventListener('keyup', (event) => this.handleKeyUp(event))
    window.addEventListener('blur', () => this.clearKeys())

    app.extensionManager.setting.set('Comfy.KeybindContext', 'global')
  }

  private clearKeys() {
    this.modifiers = []
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.modifiers = this.modifiers.filter((key) => key !== event.key)
  }

  private setContext(event?: KeyboardEvent) {
    if (!event) return
    event.preventDefault()
    const context = app.extensionManager.setting.get('Comfy.KeybindContext')
    this.context = context
  }

  private async handleKeyDown(event: KeyboardEvent) {
    if (!app.vueAppReady) return

    if (event.key === 'Escape' && this.modifiers.length === 0) {
      event.preventDefault()
      this.handleEscapeKey()
      return
    }

    if (event.key === 'F12') return // prevent opening dev tools

    const target = event.composedPath()[0] as HTMLElement
    const excludedTags = ['TEXTAREA', 'INPUT', 'SPAN']

    if (this.context === 'global') {
      if (
        excludedTags.includes(target.tagName) ||
        target.classList.contains('property_value')
      ) {
        return
      }
    }

    this.setContext(event)

    const keyCombo = KeyComboImpl.fromEvent(event)
    if (keyCombo.isModifier) return
    const keybindingStore = useKeybindingStore()
    const commandStore = useCommandStore()
    const keybinding = keybindingStore.getKeybinding(keyCombo, this.context)
    console.log(keyCombo, keybinding)
    if (keybinding) {
      console.log('executing command', keybinding.commandId)
      event.preventDefault()
      await commandStore.execute(keybinding.commandId)
      return
    }
  }

  private handleEscapeKey() {
    const modals = document.querySelectorAll<HTMLElement>('.comfy-modal')
    const modal = Array.from(modals).find(
      (modal) =>
        window.getComputedStyle(modal).getPropertyValue('display') !== 'none'
    )
    if (modal) {
      modal.style.display = 'none'
    }

    ;[...document.querySelectorAll('dialog')].forEach((d) => {
      d.close()
    })
  }

  setKeybindingContext(context: string) {
    this.context = context
  }
}

app.registerExtension({
  name: 'Comfy.Keybinds',
  init() {
    const manager = new KeyboardManager()
  }
})
