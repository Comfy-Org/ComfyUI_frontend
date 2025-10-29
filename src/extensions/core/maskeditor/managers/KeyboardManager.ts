import type { MaskEditorDialog } from '../MaskEditorDialog'
import type { MessageBroker } from './MessageBroker'

export class KeyboardManager {
  private keysDown: string[] = []

  // @ts-expect-error unused variable
  private maskEditor: MaskEditorDialog
  private messageBroker: MessageBroker

  // Bound functions, for use in addListeners and removeListeners
  private handleKeyDownBound = this.handleKeyDown.bind(this)
  private handleKeyUpBound = this.handleKeyUp.bind(this)
  private clearKeysBound = this.clearKeys.bind(this)

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.addPullTopics()
  }

  private addPullTopics() {
    // isKeyPressed
    this.messageBroker.createPullTopic('isKeyPressed', (key: string) =>
      Promise.resolve(this.isKeyDown(key))
    )
  }

  addListeners() {
    document.addEventListener('keydown', this.handleKeyDownBound)
    document.addEventListener('keyup', this.handleKeyUpBound)
    window.addEventListener('blur', this.clearKeysBound)
  }

  removeListeners() {
    document.removeEventListener('keydown', this.handleKeyDownBound)
    document.removeEventListener('keyup', this.handleKeyUpBound)
    window.removeEventListener('blur', this.clearKeysBound)
  }

  private clearKeys() {
    this.keysDown = []
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (!this.keysDown.includes(event.key)) {
      this.keysDown.push(event.key)
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toUpperCase()
      // Redo: Ctrl + Y, or Ctrl + Shift + Z
      if ((key === 'Y' && !event.shiftKey) || (key == 'Z' && event.shiftKey)) {
        this.messageBroker.publish('redo')
      } else if (key === 'Z' && !event.shiftKey) {
        this.messageBroker.publish('undo')
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.keysDown = this.keysDown.filter((key) => key !== event.key)
  }

  private isKeyDown(key: string) {
    return this.keysDown.includes(key)
  }
}
