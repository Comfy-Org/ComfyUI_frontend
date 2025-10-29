import { ColorComparisonMethod, type Point } from '../types'

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

class ColorSelectTool {
  // @ts-expect-error unused variable
  private maskEditor!: MaskEditorDialog
  private messageBroker!: MessageBroker
  private width: number | null = null
  private height: number | null = null
  private canvas!: HTMLCanvasElement
  private maskCTX!: CanvasRenderingContext2D
  private imageCTX!: CanvasRenderingContext2D
  private maskData: Uint8ClampedArray | null = null
  private imageData: Uint8ClampedArray | null = null
  private tolerance: number = 20
  private livePreview: boolean = false
  private lastPoint: Point | null = null
  private colorComparisonMethod: ColorComparisonMethod =
    ColorComparisonMethod.Simple
  private applyWholeImage: boolean = false
  private maskBoundry: boolean = false
  private maskTolerance: number = 0
  private selectOpacity: number = 255 // Add opacity property (default 100%)

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.createListeners()
    this.addPullTopics()
  }

  async initColorSelectTool() {
    await this.pullCanvas()
  }

  private async pullCanvas() {
    this.canvas = await this.messageBroker.pull('imgCanvas')
    this.maskCTX = await this.messageBroker.pull('maskCtx')
    this.imageCTX = await this.messageBroker.pull('imageCtx')
  }

  private createListeners() {
    this.messageBroker.subscribe('colorSelectFill', (point: Point) =>
      this.fillColorSelection(point)
    )
    this.messageBroker.subscribe(
      'setColorSelectTolerance',
      (tolerance: number) => this.setTolerance(tolerance)
    )
    this.messageBroker.subscribe('setLivePreview', (livePreview: boolean) =>
      this.setLivePreview(livePreview)
    )
    this.messageBroker.subscribe(
      'setColorComparisonMethod',
      (method: ColorComparisonMethod) => this.setComparisonMethod(method)
    )

    this.messageBroker.subscribe('clearLastPoint', () => this.clearLastPoint())

    this.messageBroker.subscribe('setWholeImage', (applyWholeImage: boolean) =>
      this.setApplyWholeImage(applyWholeImage)
    )

    this.messageBroker.subscribe('setMaskBoundary', (maskBoundry: boolean) =>
      this.setMaskBoundary(maskBoundry)
    )

    this.messageBroker.subscribe('setMaskTolerance', (maskTolerance: number) =>
      this.setMaskTolerance(maskTolerance)
    )

    // Add new listener for opacity setting
    this.messageBroker.subscribe('setSelectionOpacity', (opacity: number) =>
      this.setSelectOpacity(opacity)
    )
  }

  private async addPullTopics() {
    this.messageBroker.createPullTopic(
      'getLivePreview',
      async () => this.livePreview
    )
  }

  private getPixel(x: number, y: number): { r: number; g: number; b: number } {
    const index = (y * this.width! + x) * 4
    return {
      r: this.imageData![index],
      g: this.imageData![index + 1],
      b: this.imageData![index + 2]
    }
  }

  private getMaskAlpha(x: number, y: number): number {
    return this.maskData![(y * this.width! + x) * 4 + 3]
  }

  private isPixelInRange(
    pixel: { r: number; g: number; b: number },
    target: { r: number; g: number; b: number }
  ): boolean {
    switch (this.colorComparisonMethod) {
      case ColorComparisonMethod.Simple:
        return this.isPixelInRangeSimple(pixel, target)
      case ColorComparisonMethod.HSL:
        return this.isPixelInRangeHSL(pixel, target)
      case ColorComparisonMethod.LAB:
        return this.isPixelInRangeLab(pixel, target)
      default:
        return this.isPixelInRangeSimple(pixel, target)
    }
  }

  private isPixelInRangeSimple(
    pixel: { r: number; g: number; b: number },
    target: { r: number; g: number; b: number }
  ): boolean {
    //calculate the euclidean distance between the two colors
    const distance = Math.sqrt(
      Math.pow(pixel.r - target.r, 2) +
        Math.pow(pixel.g - target.g, 2) +
        Math.pow(pixel.b - target.b, 2)
    )
    return distance <= this.tolerance
  }

  private isPixelInRangeHSL(
    pixel: { r: number; g: number; b: number },
    target: { r: number; g: number; b: number }
  ): boolean {
    // Convert RGB to HSL
    const pixelHSL = this.rgbToHSL(pixel.r, pixel.g, pixel.b)
    const targetHSL = this.rgbToHSL(target.r, target.g, target.b)

    // Compare mainly hue and saturation, be more lenient with lightness
    const hueDiff = Math.abs(pixelHSL.h - targetHSL.h)
    const satDiff = Math.abs(pixelHSL.s - targetHSL.s)
    const lightDiff = Math.abs(pixelHSL.l - targetHSL.l)

    const distance = Math.sqrt(
      Math.pow((hueDiff / 360) * 255, 2) +
        Math.pow((satDiff / 100) * 255, 2) +
        Math.pow((lightDiff / 100) * 255, 2)
    )
    return distance <= this.tolerance
  }

  private rgbToHSL(
    r: number,
    g: number,
    b: number
  ): { h: number; s: number; l: number } {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0,
      s = 0,
      l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }

    return {
      h: h * 360,
      s: s * 100,
      l: l * 100
    }
  }

  private isPixelInRangeLab(
    pixel: { r: number; g: number; b: number },
    target: { r: number; g: number; b: number }
  ): boolean {
    const pixelLab = this.rgbToLab(pixel)
    const targetLab = this.rgbToLab(target)

    // Calculate Delta E (CIE76 formula)
    const deltaE = Math.sqrt(
      Math.pow(pixelLab.l - targetLab.l, 2) +
        Math.pow(pixelLab.a - targetLab.a, 2) +
        Math.pow(pixelLab.b - targetLab.b, 2)
    )

    const normalizedDeltaE = (deltaE / 100) * 255
    return normalizedDeltaE <= this.tolerance
  }

  private rgbToLab(rgb: { r: number; g: number; b: number }): {
    l: number
    a: number
    b: number
  } {
    // First convert RGB to XYZ
    let r = rgb.r / 255
    let g = rgb.g / 255
    let b = rgb.b / 255

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92

    r *= 100
    g *= 100
    b *= 100

    const x = r * 0.4124 + g * 0.3576 + b * 0.1805
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722
    const z = r * 0.0193 + g * 0.1192 + b * 0.9505

    // Then XYZ to Lab
    const xn = 95.047
    const yn = 100.0
    const zn = 108.883

    const xyz = [x / xn, y / yn, z / zn]
    for (let i = 0; i < xyz.length; i++) {
      xyz[i] =
        xyz[i] > 0.008856 ? Math.pow(xyz[i], 1 / 3) : 7.787 * xyz[i] + 16 / 116
    }

    return {
      l: 116 * xyz[1] - 16,
      a: 500 * (xyz[0] - xyz[1]),
      b: 200 * (xyz[1] - xyz[2])
    }
  }

  private setPixel(
    x: number,
    y: number,
    alpha: number,
    color: { r: number; g: number; b: number }
  ): void {
    const index = (y * this.width! + x) * 4
    this.maskData![index] = color.r // R
    this.maskData![index + 1] = color.g // G
    this.maskData![index + 2] = color.b // B
    this.maskData![index + 3] = alpha // A
  }

  async fillColorSelection(point: Point) {
    this.width = this.canvas.width
    this.height = this.canvas.height
    this.lastPoint = point

    // Get image data
    const maskData = this.maskCTX.getImageData(0, 0, this.width, this.height)
    this.maskData = maskData.data
    this.imageData = this.imageCTX.getImageData(
      0,
      0,
      this.width,
      this.height
    ).data

    if (this.applyWholeImage) {
      // Process entire image
      const targetPixel = this.getPixel(
        Math.floor(point.x),
        Math.floor(point.y)
      )
      const maskColor = await this.messageBroker.pull<{
        r: number
        g: number
        b: number
      }>('getMaskColor')

      // Use TypedArrays for better performance
      const width = this.width!
      const height = this.height!

      // Process in chunks for better performance
      const CHUNK_SIZE = 10000
      for (let i = 0; i < width * height; i += CHUNK_SIZE) {
        const endIndex = Math.min(i + CHUNK_SIZE, width * height)
        for (let pixelIndex = i; pixelIndex < endIndex; pixelIndex++) {
          const x = pixelIndex % width
          const y = Math.floor(pixelIndex / width)
          if (this.isPixelInRange(this.getPixel(x, y), targetPixel)) {
            this.setPixel(x, y, this.selectOpacity, maskColor) // Use selectOpacity instead of 255
          }
        }
        // Allow UI updates between chunks
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    } else {
      // Original flood fill logic
      let startX = Math.floor(point.x)
      let startY = Math.floor(point.y)

      if (
        startX < 0 ||
        startX >= this.width ||
        startY < 0 ||
        startY >= this.height
      ) {
        return
      }

      const pixel = this.getPixel(startX, startY)

      const stack: Array<[number, number]> = []
      const visited = new Uint8Array(this.width * this.height)

      stack.push([startX, startY])
      const maskColor = await this.messageBroker.pull<{
        r: number
        g: number
        b: number
      }>('getMaskColor')

      while (stack.length > 0) {
        const [x, y] = stack.pop()!
        const visitedIndex = y * this.width + x

        if (
          visited[visitedIndex] ||
          !this.isPixelInRange(this.getPixel(x, y), pixel)
        ) {
          continue
        }

        visited[visitedIndex] = 1
        this.setPixel(x, y, this.selectOpacity, maskColor) // Use selectOpacity instead of 255

        // Inline direction checks for better performance
        if (
          x > 0 &&
          !visited[y * this.width + (x - 1)] &&
          this.isPixelInRange(this.getPixel(x - 1, y), pixel)
        ) {
          if (
            !this.maskBoundry ||
            255 - this.getMaskAlpha(x - 1, y) > this.maskTolerance
          ) {
            stack.push([x - 1, y])
          }
        }
        if (
          x < this.width - 1 &&
          !visited[y * this.width + (x + 1)] &&
          this.isPixelInRange(this.getPixel(x + 1, y), pixel)
        ) {
          if (
            !this.maskBoundry ||
            255 - this.getMaskAlpha(x + 1, y) > this.maskTolerance
          ) {
            stack.push([x + 1, y])
          }
        }
        if (
          y > 0 &&
          !visited[(y - 1) * this.width + x] &&
          this.isPixelInRange(this.getPixel(x, y - 1), pixel)
        ) {
          if (
            !this.maskBoundry ||
            255 - this.getMaskAlpha(x, y - 1) > this.maskTolerance
          ) {
            stack.push([x, y - 1])
          }
        }
        if (
          y < this.height - 1 &&
          !visited[(y + 1) * this.width + x] &&
          this.isPixelInRange(this.getPixel(x, y + 1), pixel)
        ) {
          if (
            !this.maskBoundry ||
            255 - this.getMaskAlpha(x, y + 1) > this.maskTolerance
          ) {
            stack.push([x, y + 1])
          }
        }
      }
    }

    this.maskCTX.putImageData(maskData, 0, 0)
    this.messageBroker.publish('saveState')
    this.maskData = null
    this.imageData = null
  }
  setTolerance(tolerance: number): void {
    this.tolerance = tolerance

    if (this.lastPoint && this.livePreview) {
      this.messageBroker.publish('undo')
      this.fillColorSelection(this.lastPoint)
    }
  }

  setLivePreview(livePreview: boolean): void {
    this.livePreview = livePreview
  }

  setComparisonMethod(method: ColorComparisonMethod): void {
    this.colorComparisonMethod = method

    if (this.lastPoint && this.livePreview) {
      this.messageBroker.publish('undo')
      this.fillColorSelection(this.lastPoint)
    }
  }

  clearLastPoint() {
    this.lastPoint = null
  }

  setApplyWholeImage(applyWholeImage: boolean): void {
    this.applyWholeImage = applyWholeImage
  }

  setMaskBoundary(maskBoundry: boolean): void {
    this.maskBoundry = maskBoundry
  }

  setMaskTolerance(maskTolerance: number): void {
    this.maskTolerance = maskTolerance
  }

  // Add method to set opacity
  setSelectOpacity(opacity: number): void {
    // Convert from percentage (0-100) to alpha value (0-255)
    this.selectOpacity = Math.floor((opacity / 100) * 255)

    // Update preview if applicable
    if (this.lastPoint && this.livePreview) {
      this.messageBroker.publish('undo')
      this.fillColorSelection(this.lastPoint)
    }
  }
}

export { ColorSelectTool }
