import type { IColorWidget } from '../types/widgets'
import { hexToInt, intToHex } from '@/utils/colorUtil'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'
import { BaseWidget } from './BaseWidget'

// Have one color input to prevent leaking instances
// Browsers don't seem to fire any events when the color picker is cancelled
let colorInput: HTMLInputElement | null = null

function getColorInput(): HTMLInputElement {
  if (!colorInput) {
    colorInput = document.createElement('input')
    colorInput.type = 'color'
    colorInput.style.position = 'absolute'
    colorInput.style.opacity = '0'
    colorInput.style.pointerEvents = 'none'
    colorInput.style.zIndex = '-999'
    document.body.appendChild(colorInput)
  }
  return colorInput
}

/**
 * Widget for displaying a color picker using native HTML color input
 */
export class ColorWidget
  extends BaseWidget<IColorWidget>
  implements IColorWidget
{
  private get hexValue(): string {
    return typeof this.value === 'number'
      ? intToHex(this.value)
      : this.value || '#000000'
  }

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    const { fillStyle, strokeStyle, textAlign } = ctx

    this.drawWidgetShape(ctx, options)

    const { width } = options
    const { height, y } = this
    const { margin } = BaseWidget

    const swatchWidth = 40
    const swatchHeight = height - 6
    const swatchRadius = swatchHeight / 2
    const rightPadding = 10

    // Swatch fixed on the right
    const swatchX = width - margin - rightPadding - swatchWidth
    const swatchY = y + 3

    // Draw color swatch as rounded pill
    ctx.beginPath()
    ctx.roundRect(swatchX, swatchY, swatchWidth, swatchHeight, swatchRadius)
    ctx.fillStyle = this.hexValue
    ctx.fill()

    // Draw label on the left
    ctx.fillStyle = this.secondary_text_color
    ctx.textAlign = 'left'
    ctx.fillText(this.displayName, margin * 2 + 5, y + height * 0.7)

    // Draw hex value to the left of swatch
    ctx.fillStyle = this.text_color
    ctx.textAlign = 'right'
    ctx.fillText(this.hexValue, swatchX - 8, y + height * 0.7)

    Object.assign(ctx, { textAlign, strokeStyle, fillStyle })
  }

  onClick({ e, node, canvas }: WidgetEventOptions): void {
    const input = getColorInput()
    input.value = this.hexValue
    input.style.left = `${e.clientX}px`
    input.style.top = `${e.clientY}px`

    input.addEventListener(
      'change',
      () => {
        const value =
          typeof this.value === 'number' ? hexToInt(input.value) : input.value
        this.setValue(value, { e, node, canvas })
        canvas.setDirty(true)
      },
      { once: true }
    )

    // Wait for next frame else Chrome doesn't render the color picker at the mouse
    // Firefox always opens it in top left of window on Windows
    requestAnimationFrame(() => input.click())
  }
}
