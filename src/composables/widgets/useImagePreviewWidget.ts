import { type LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import type {
  IBaseWidget,
  ICustomWidget,
  IWidgetOptions
} from '@comfyorg/litegraph/dist/types/widgets'

import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { calculateImageGrid } from '@/scripts/ui/imagePreview'
import { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import { is_all_same_aspect_ratio } from '@/utils/imageUtil'

const renderPreview = (
  ctx: CanvasRenderingContext2D,
  node: LGraphNode,
  shiftY: number
) => {
  const canvas = app.canvas
  const mouse = canvas.graph_mouse

  if (!canvas.pointer_is_down && node.pointerDown) {
    if (
      mouse[0] === node.pointerDown.pos[0] &&
      mouse[1] === node.pointerDown.pos[1]
    ) {
      node.imageIndex = node.pointerDown.index
    }
    node.pointerDown = null
  }

  const imgs = node.imgs ?? []
  let { imageIndex } = node
  const numImages = imgs.length
  if (numImages === 1 && !imageIndex) {
    // This skips the thumbnail render section below
    node.imageIndex = imageIndex = 0
  }

  const IMAGE_TEXT_SIZE_TEXT_HEIGHT = 15
  const dw = node.size[0]
  const dh = node.size[1] - shiftY - IMAGE_TEXT_SIZE_TEXT_HEIGHT

  if (imageIndex == null) {
    // No image selected; draw thumbnails of all
    let cellWidth: number
    let cellHeight: number
    let shiftX: number
    let cell_padding: number
    let cols: number

    const compact_mode = is_all_same_aspect_ratio(imgs)
    if (!compact_mode) {
      // use rectangle cell style and border line
      cell_padding = 2
      // Prevent infinite canvas2d scale-up
      const largestDimension = imgs.reduce(
        (acc, current) =>
          Math.max(acc, current.naturalWidth, current.naturalHeight),
        0
      )
      const fakeImgs = []
      fakeImgs.length = imgs.length
      fakeImgs[0] = {
        naturalWidth: largestDimension,
        naturalHeight: largestDimension
      }
      ;({ cellWidth, cellHeight, cols, shiftX } = calculateImageGrid(
        fakeImgs,
        dw,
        dh
      ))
    } else {
      cell_padding = 0
      ;({ cellWidth, cellHeight, cols, shiftX } = calculateImageGrid(
        imgs,
        dw,
        dh
      ))
    }

    let anyHovered = false
    node.imageRects = []
    for (let i = 0; i < numImages; i++) {
      const img = imgs[i]
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * cellWidth + shiftX
      const y = row * cellHeight + shiftY
      if (!anyHovered) {
        anyHovered = LiteGraph.isInsideRectangle(
          mouse[0],
          mouse[1],
          x + node.pos[0],
          y + node.pos[1],
          cellWidth,
          cellHeight
        )
        if (anyHovered) {
          node.overIndex = i
          let value = 110
          if (canvas.pointer_is_down) {
            if (!node.pointerDown || node.pointerDown.index !== i) {
              node.pointerDown = { index: i, pos: [...mouse] }
            }
            value = 125
          }
          ctx.filter = `contrast(${value}%) brightness(${value}%)`
          canvas.canvas.style.cursor = 'pointer'
        }
      }
      node.imageRects.push([x, y, cellWidth, cellHeight])

      const wratio = cellWidth / img.width
      const hratio = cellHeight / img.height
      const ratio = Math.min(wratio, hratio)

      const imgHeight = ratio * img.height
      const imgY = row * cellHeight + shiftY + (cellHeight - imgHeight) / 2
      const imgWidth = ratio * img.width
      const imgX = col * cellWidth + shiftX + (cellWidth - imgWidth) / 2

      ctx.drawImage(
        img,
        imgX + cell_padding,
        imgY + cell_padding,
        imgWidth - cell_padding * 2,
        imgHeight - cell_padding * 2
      )
      if (!compact_mode) {
        // rectangle cell and border line style
        ctx.strokeStyle = '#8F8F8F'
        ctx.lineWidth = 1
        ctx.strokeRect(
          x + cell_padding,
          y + cell_padding,
          cellWidth - cell_padding * 2,
          cellHeight - cell_padding * 2
        )
      }

      ctx.filter = 'none'
    }

    if (!anyHovered) {
      node.pointerDown = null
      node.overIndex = null
    }

    return
  }
  // Draw individual
  const img = imgs[imageIndex]
  let w = img.naturalWidth
  let h = img.naturalHeight

  const scaleX = dw / w
  const scaleY = dh / h
  const scale = Math.min(scaleX, scaleY, 1)

  w *= scale
  h *= scale

  const x = (dw - w) / 2
  const y = (dh - h) / 2 + shiftY
  ctx.drawImage(img, x, y, w, h)

  // Draw image size text below the image
  ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR
  ctx.textAlign = 'center'
  ctx.font = '10px sans-serif'
  const sizeText = `${Math.round(img.naturalWidth)} × ${Math.round(img.naturalHeight)}`
  const textY = y + h + 10
  ctx.fillText(sizeText, x + w / 2, textY)

  const drawButton = (
    x: number,
    y: number,
    sz: number,
    text: string
  ): boolean => {
    const hovered = LiteGraph.isInsideRectangle(
      mouse[0],
      mouse[1],
      x + node.pos[0],
      y + node.pos[1],
      sz,
      sz
    )
    let fill = '#333'
    let textFill = '#fff'
    let isClicking = false
    if (hovered) {
      canvas.canvas.style.cursor = 'pointer'
      if (canvas.pointer_is_down) {
        fill = '#1e90ff'
        isClicking = true
      } else {
        fill = '#eee'
        textFill = '#000'
      }
    }

    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.roundRect(x, y, sz, sz, [4])
    ctx.fill()
    ctx.fillStyle = textFill
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(text, x + 15, y + 20)

    return isClicking
  }

  if (!(numImages > 1)) return

  const imageNum = (node.imageIndex ?? 0) + 1
  if (drawButton(dw - 40, dh + shiftY - 40, 30, `${imageNum}/${numImages}`)) {
    const i = imageNum >= numImages ? 0 : imageNum
    if (!node.pointerDown || node.pointerDown.index !== i) {
      node.pointerDown = { index: i, pos: [...mouse] }
    }
  }

  if (drawButton(dw - 40, shiftY + 10, 30, `x`)) {
    if (!node.pointerDown || node.pointerDown.index !== null) {
      node.pointerDown = { index: null, pos: [...mouse] }
    }
  }
}

class ImagePreviewWidget implements ICustomWidget {
  readonly type: 'custom'
  readonly name: string
  readonly options: IWidgetOptions<unknown>
  // Dummy value to satisfy type requirements
  value: string
  y: number = 0

  constructor(name: string, options: IWidgetOptions<unknown>) {
    this.type = 'custom'
    this.name = name
    this.options = options
    this.value = ''
  }

  draw(
    ctx: CanvasRenderingContext2D,
    node: LGraphNode,
    _width: number,
    y: number,
    _height: number
  ): void {
    renderPreview(ctx, node, y)
  }

  computeLayoutSize(this: IBaseWidget) {
    return {
      minHeight: 220,
      minWidth: 1
    }
  }
}

export const useImagePreviewWidget = () => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    return node.addCustomWidget(
      new ImagePreviewWidget(inputSpec.name, {
        serialize: false
      })
    )
  }

  return widgetConstructor
}
