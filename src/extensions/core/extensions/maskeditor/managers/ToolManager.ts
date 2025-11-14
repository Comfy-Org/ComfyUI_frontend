import type { MaskEditorDialog, Point } from '../types'
import { Tools } from '../types'
import { MessageBroker } from './MessageBroker'

export class ToolManager {
  maskEditor: MaskEditorDialog
  messageBroker: MessageBroker
  mouseDownPoint: Point | null = null

  currentTool: Tools = Tools.MaskPen
  isAdjustingBrush: boolean = false // is user adjusting brush size or hardness with alt + right mouse button

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.addListeners()
    this.addPullTopics()
  }

  private addListeners() {
    this.messageBroker.subscribe('setTool', async (tool: Tools) => {
      this.setTool(tool)
    })

    this.messageBroker.subscribe('pointerDown', async (event: PointerEvent) => {
      this.handlePointerDown(event)
    })

    this.messageBroker.subscribe('pointerMove', async (event: PointerEvent) => {
      this.handlePointerMove(event)
    })

    this.messageBroker.subscribe('pointerUp', async (event: PointerEvent) => {
      this.handlePointerUp(event)
    })

    this.messageBroker.subscribe('wheel', async (event: WheelEvent) => {
      this.handleWheelEvent(event)
    })
  }

  private async addPullTopics() {
    this.messageBroker.createPullTopic('currentTool', async () =>
      this.getCurrentTool()
    )
  }

  //tools

  setTool(tool: Tools) {
    this.currentTool = tool

    if (tool != Tools.MaskColorFill) {
      this.messageBroker.publish('clearLastPoint')
    }
  }

  getCurrentTool() {
    return this.currentTool
  }

  private async handlePointerDown(event: PointerEvent) {
    event.preventDefault()
    if (event.pointerType == 'touch') return

    var isSpacePressed = await this.messageBroker.pull('isKeyPressed', ' ')

    // Pan canvas
    if (event.buttons === 4 || (event.buttons === 1 && isSpacePressed)) {
      this.messageBroker.publish('panStart', event)
      this.messageBroker.publish('setBrushVisibility', false)
      return
    }

    // RGB painting
    if (this.currentTool === Tools.PaintPen && event.button === 0) {
      this.messageBroker.publish('drawStart', event)
      this.messageBroker.publish('saveState')
      return
    }

    // RGB painting
    if (this.currentTool === Tools.PaintPen && event.buttons === 1) {
      this.messageBroker.publish('draw', event)
      return
    }

    //paint bucket
    if (this.currentTool === Tools.MaskBucket && event.button === 0) {
      const offset = { x: event.offsetX, y: event.offsetY }
      const coords_canvas = await this.messageBroker.pull(
        'screenToCanvas',
        offset
      )
      this.messageBroker.publish('paintBucketFill', coords_canvas)
      this.messageBroker.publish('saveState')
      return
    }

    if (this.currentTool === Tools.MaskColorFill && event.button === 0) {
      const offset = { x: event.offsetX, y: event.offsetY }
      const coords_canvas = await this.messageBroker.pull(
        'screenToCanvas',
        offset
      )
      this.messageBroker.publish('colorSelectFill', coords_canvas)
      return
    }

    // (brush resize/change hardness) Check for alt + right mouse button
    if (event.altKey && event.button === 2) {
      this.isAdjustingBrush = true
      this.messageBroker.publish('brushAdjustmentStart', event)
      return
    }

    var isDrawingTool = [Tools.MaskPen, Tools.Eraser, Tools.PaintPen].includes(
      this.currentTool
    )
    //drawing
    if ([0, 2].includes(event.button) && isDrawingTool) {
      this.messageBroker.publish('drawStart', event)
      return
    }
  }

  private async handlePointerMove(event: PointerEvent) {
    event.preventDefault()
    if (event.pointerType == 'touch') return
    const newCursorPoint = { x: event.clientX, y: event.clientY }
    this.messageBroker.publish('cursorPoint', newCursorPoint)

    var isSpacePressed = await this.messageBroker.pull('isKeyPressed', ' ')
    this.messageBroker.publish('updateBrushPreview')

    //move the canvas
    if (event.buttons === 4 || (event.buttons === 1 && isSpacePressed)) {
      this.messageBroker.publish('panMove', event)
      return
    }

    //prevent drawing with other tools

    var isDrawingTool = [Tools.MaskPen, Tools.Eraser, Tools.PaintPen].includes(
      this.currentTool
    )
    if (!isDrawingTool) return

    // alt + right mouse button hold brush adjustment
    if (
      this.isAdjustingBrush &&
      (this.currentTool === Tools.MaskPen ||
        this.currentTool === Tools.Eraser) &&
      event.altKey &&
      event.buttons === 2
    ) {
      this.messageBroker.publish('brushAdjustment', event)
      return
    }

    //draw with pen or eraser
    if (event.buttons == 1 || event.buttons == 2) {
      this.messageBroker.publish('draw', event)
      return
    }
  }

  private handlePointerUp(event: PointerEvent) {
    this.messageBroker.publish('panCursor', false)
    if (event.pointerType === 'touch') return
    this.messageBroker.publish('updateCursor')
    this.isAdjustingBrush = false
    this.messageBroker.publish('drawEnd', event)
    this.mouseDownPoint = null
  }

  private handleWheelEvent(event: WheelEvent) {
    this.messageBroker.publish('zoom', event)
    const newCursorPoint = { x: event.clientX, y: event.clientY }
    this.messageBroker.publish('cursorPoint', newCursorPoint)
  }
}
