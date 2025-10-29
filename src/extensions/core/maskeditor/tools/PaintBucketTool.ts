import type { Point } from '../types'

// Forward declaration for MessageBroker type
interface MessageBroker {
  subscribe(topic: string, callback: (data?: any) => void): void
  publish(topic: string, data?: any): void
  pull<T>(topic: string, data?: any): Promise<T>
  createPullTopic(topic: string, callback: (data?: any) => Promise<any>): void
}

// Forward declaration for MaskEditorDialog type
interface MaskEditorDialog {
  getMessageBroker(): MessageBroker
}

class PaintBucketTool {
  maskEditor: MaskEditorDialog
  messageBroker: MessageBroker

  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private width: number | null = null
  private height: number | null = null
  private imageData: ImageData | null = null
  private data: Uint8ClampedArray | null = null
  private tolerance: number = 5
  private fillOpacity: number = 255 // Add opacity property (default 100%)

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.createListeners()
    this.addPullTopics()
  }

  initPaintBucketTool() {
    this.pullCanvas()
  }

  private async pullCanvas() {
    this.canvas = await this.messageBroker.pull('maskCanvas')
    this.ctx = await this.messageBroker.pull('maskCtx')
  }

  private createListeners() {
    this.messageBroker.subscribe(
      'setPaintBucketTolerance',
      (tolerance: number) => this.setTolerance(tolerance)
    )

    this.messageBroker.subscribe('paintBucketFill', (point: Point) =>
      this.floodFill(point)
    )

    this.messageBroker.subscribe('invert', () => this.invertMask())

    // Add new listener for opacity setting
    this.messageBroker.subscribe('setFillOpacity', (opacity: number) =>
      this.setFillOpacity(opacity)
    )
  }

  private addPullTopics() {
    this.messageBroker.createPullTopic(
      'getTolerance',
      async () => this.tolerance
    )
    // Add pull topic for fillOpacity
    this.messageBroker.createPullTopic(
      'getFillOpacity',
      async () => (this.fillOpacity / 255) * 100
    )
  }

  // Add method to set opacity
  setFillOpacity(opacity: number): void {
    // Convert from percentage (0-100) to alpha value (0-255)
    this.fillOpacity = Math.floor((opacity / 100) * 255)
  }

  private getPixel(x: number, y: number): number {
    return this.data![(y * this.width! + x) * 4 + 3]
  }

  private setPixel(
    x: number,
    y: number,
    alpha: number,
    color: { r: number; g: number; b: number }
  ): void {
    const index = (y * this.width! + x) * 4
    this.data![index] = color.r // R
    this.data![index + 1] = color.g // G
    this.data![index + 2] = color.b // B
    this.data![index + 3] = alpha // A
  }

  private shouldProcessPixel(
    currentAlpha: number,
    targetAlpha: number,
    tolerance: number,
    isFillMode: boolean
  ): boolean {
    if (currentAlpha === -1) return false

    if (isFillMode) {
      // Fill mode: process pixels that are empty/similar to target
      return (
        currentAlpha !== 255 &&
        Math.abs(currentAlpha - targetAlpha) <= tolerance
      )
    } else {
      // Erase mode: process pixels that are filled/similar to target
      return (
        currentAlpha === 255 ||
        Math.abs(currentAlpha - targetAlpha) <= tolerance
      )
    }
  }

  private async floodFill(point: Point): Promise<void> {
    let startX = Math.floor(point.x)
    let startY = Math.floor(point.y)
    this.width = this.canvas.width
    this.height = this.canvas.height

    if (
      startX < 0 ||
      startX >= this.width ||
      startY < 0 ||
      startY >= this.height
    ) {
      return
    }

    this.imageData = this.ctx.getImageData(0, 0, this.width, this.height)
    this.data = this.imageData.data

    const targetAlpha = this.getPixel(startX, startY)
    const isFillMode = targetAlpha !== 255 // Determine mode based on clicked pixel

    if (targetAlpha === -1) return

    const maskColor = await this.messageBroker.pull<{
      r: number
      g: number
      b: number
    }>('getMaskColor')
    const stack: Array<[number, number]> = []
    const visited = new Uint8Array(this.width * this.height)

    if (
      this.shouldProcessPixel(
        targetAlpha,
        targetAlpha,
        this.tolerance,
        isFillMode
      )
    ) {
      stack.push([startX, startY])
    }

    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      const visitedIndex = y * this.width + x

      if (visited[visitedIndex]) continue

      const currentAlpha = this.getPixel(x, y)
      if (
        !this.shouldProcessPixel(
          currentAlpha,
          targetAlpha,
          this.tolerance,
          isFillMode
        )
      ) {
        continue
      }

      visited[visitedIndex] = 1
      // Set alpha to fillOpacity for fill mode, 0 for erase mode
      this.setPixel(x, y, isFillMode ? this.fillOpacity : 0, maskColor)

      // Check neighbors
      const checkNeighbor = (nx: number, ny: number) => {
        if (nx < 0 || nx >= this.width! || ny < 0 || ny >= this.height!) return
        if (!visited[ny * this.width! + nx]) {
          const alpha = this.getPixel(nx, ny)
          if (
            this.shouldProcessPixel(
              alpha,
              targetAlpha,
              this.tolerance,
              isFillMode
            )
          ) {
            stack.push([nx, ny])
          }
        }
      }

      checkNeighbor(x - 1, y) // Left
      checkNeighbor(x + 1, y) // Right
      checkNeighbor(x, y - 1) // Up
      checkNeighbor(x, y + 1) // Down
    }

    this.ctx.putImageData(this.imageData, 0, 0)
    this.imageData = null
    this.data = null
  }

  setTolerance(tolerance: number): void {
    this.tolerance = tolerance
  }

  getTolerance(): number {
    return this.tolerance
  }

  //invert mask

  private invertMask() {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    )
    const data = imageData.data

    // Find first non-transparent pixel to get mask color
    let maskR = 0,
      maskG = 0,
      maskB = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        maskR = data[i]
        maskG = data[i + 1]
        maskB = data[i + 2]
        break
      }
    }

    // Process each pixel
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]
      // Invert alpha channel (0 becomes 255, 255 becomes 0)
      data[i + 3] = 255 - alpha

      // If this was originally transparent (now opaque), fill with mask color
      if (alpha === 0) {
        data[i] = maskR
        data[i + 1] = maskG
        data[i + 2] = maskB
      }
    }

    this.ctx.putImageData(imageData, 0, 0)
    this.messageBroker.publish('saveState')
  }
}

export { PaintBucketTool }
