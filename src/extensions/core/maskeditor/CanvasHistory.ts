import type { MaskEditorDialog } from './MaskEditorDialog'
import type { MessageBroker } from './managers/MessageBroker'

export class CanvasHistory {
  // @ts-expect-error unused variable
  private maskEditor!: MaskEditorDialog
  private messageBroker!: MessageBroker

  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private rgbCanvas!: HTMLCanvasElement
  private rgbCtx!: CanvasRenderingContext2D
  private states: { mask: ImageData; rgb: ImageData }[] = []
  private currentStateIndex: number = -1
  private maxStates: number = 20
  private initialized: boolean = false

  constructor(maskEditor: MaskEditorDialog, maxStates = 20) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.maxStates = maxStates
    this.createListeners()
  }

  private async pullCanvas() {
    this.canvas = await this.messageBroker.pull('maskCanvas')
    this.ctx = await this.messageBroker.pull('maskCtx')
    this.rgbCanvas = await this.messageBroker.pull('rgbCanvas')
    this.rgbCtx = await this.messageBroker.pull('rgbCtx')
  }

  private createListeners() {
    this.messageBroker.subscribe('saveState', () => this.saveState())
    this.messageBroker.subscribe('undo', () => this.undo())
    this.messageBroker.subscribe('redo', () => this.redo())
  }

  clearStates() {
    this.states = []
    this.currentStateIndex = -1
    this.initialized = false
  }

  async saveInitialState() {
    await this.pullCanvas()
    if (
      !this.canvas.width ||
      !this.canvas.height ||
      !this.rgbCanvas.width ||
      !this.rgbCanvas.height
    ) {
      // Canvas not ready yet, defer initialization
      requestAnimationFrame(() => this.saveInitialState())
      return
    }

    this.clearStates()
    const maskState = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    )
    const rgbState = this.rgbCtx.getImageData(
      0,
      0,
      this.rgbCanvas.width,
      this.rgbCanvas.height
    )
    this.states.push({ mask: maskState, rgb: rgbState })
    this.currentStateIndex = 0
    this.initialized = true
  }

  saveState() {
    // Ensure we have an initial state
    if (!this.initialized || this.currentStateIndex === -1) {
      this.saveInitialState()
      return
    }

    this.states = this.states.slice(0, this.currentStateIndex + 1)
    const maskState = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    )
    const rgbState = this.rgbCtx.getImageData(
      0,
      0,
      this.rgbCanvas.width,
      this.rgbCanvas.height
    )
    this.states.push({ mask: maskState, rgb: rgbState })
    this.currentStateIndex++

    if (this.states.length > this.maxStates) {
      this.states.shift()
      this.currentStateIndex--
    }
  }

  undo() {
    if (this.states.length > 1 && this.currentStateIndex > 0) {
      this.currentStateIndex--
      this.restoreState(this.states[this.currentStateIndex])
    } else {
      alert('No more undo states available')
    }
  }

  redo() {
    if (
      this.states.length > 1 &&
      this.currentStateIndex < this.states.length - 1
    ) {
      this.currentStateIndex++
      this.restoreState(this.states[this.currentStateIndex])
    } else {
      alert('No more redo states available')
    }
  }

  restoreState(state: { mask: ImageData; rgb: ImageData }) {
    if (state && this.initialized) {
      this.ctx.putImageData(state.mask, 0, 0)
      this.rgbCtx.putImageData(state.rgb, 0, 0)
    }
  }
}
