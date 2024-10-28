// @ts-strict-ignore

import { app } from '../../scripts/app'
import { ComfyDialog, $el } from '../../scripts/ui'
import { ComfyApp } from '../../scripts/app'
import { api } from '../../scripts/api'
import { ClipspaceDialog } from './clipspace'

/*
Fixes needed:
- undo message comes and undo is still exdecuted ?
- when drawing lines, take into account potential new pan and zoom
- undo states get grouped together when drawing lines
- previous image is sometimes loaded when mask is saved
- fill is in wrong color if color changed before fill
- repair drawing and line drawing
- hide brush when closing
- add keyboard shortcuts
*/

var styles = `
#maskEditorContainer {
  display: fixed;
}
#maskEditor {
  display: block;
  width: 100%;
  height: calc(100vh - 44px);
  top: 44px;
  left: 0;
  z-index: 8888;
  position: fixed;
  background: rgba(50,50,50,0.75);
  backdrop-filter: blur(10px);
  overflow: hidden;
  user-select: none;
}
#maskEditor_sidePanelContainer {
  height: 100%;
  width: 220px;
  z-index: 8888;
  display: flex;
  flex-direction: column;
}
#maskEditor_sidePanel {
  background: var(--comfy-menu-bg);
  height: 100%;
  display: flex;
  flex-direction: column;  
  align-items: center;
}
#maskEditor_sidePanelShortcuts {
  display: flex;
  flex-direction: row;
  width: 200px;    
  margin-top: 10px;
  gap: 10px;
  justify-content: center;
}
.maskEditor_sidePanelIconButton {
  width: 40px;
  height: 40px;
  pointer-events: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.1s;
}
.maskEditor_sidePanelIconButton:hover {
  background-color: var(--p-surface-800);
}
#maskEditor_sidePanelBrushSettings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 200px;
  padding: 10px;
}
.maskEditor_sidePanelTitle {
  text-align: center;
  font-size: 15px;
  font-family: sans-serif;
  color: var(--descrip-text);
  margin-top: 10px;
}
#maskEditor_sidePanelBrushShapeContainer {
  display: flex;
  width: 180px;
  height: 50px;
  border: 1px solid var(--border-color);
  pointer-events: auto;
  background: var(--p-surface-800);
}
#maskEditor_sidePanelBrushShapeCircle {
  width: 35px;
  height: 35px;
  margin: 5px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  pointer-events: auto;
  transition: background 0.1s;
}
.maskEditor_sidePanelBrushRange {
  width: 180px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.maskEditor_sidePanelBrushRange::-webkit-slider-thumb {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  cursor: grab;
  margin-top: -8px;
  background: var(--p-surface-700);
  border: 1px solid var(--border-color);
}
.maskEditor_sidePanelBrushRange::-moz-range-thumb {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  cursor: grab;
  background: var(--p-surface-800);
  border: 1px solid var(--border-color);
}
.maskEditor_sidePanelBrushRange::-webkit-slider-runnable-track {
  background: var(--p-surface-700);
  height: 3px;
}
.maskEditor_sidePanelBrushRange::-moz-range-track {
  background: var(--p-surface-700);
  height: 3px;
}
#maskEditor_sidePanelBrushShapeCircle:hover {
  background: var(--p-overlaybadge-outline-color);
}
#maskEditor_sidePanelBrushShapeSquare {
  width: 35px;
  height: 35px;
  margin: 5px;
  border: 1px solid var(--border-color);
  pointer-events: auto;
  transition: background 0.1s;
}
#maskEditor_sidePanelBrushShapeSquare:hover {
  background: var(--p-overlaybadge-outline-color);
}
.maskEditor_sidePanelSubTitle {
  text-align: center;
  font-size: 12px;
  font-family: sans-serif;
  color: var(--descrip-text);
}
#maskEditor_sidePanelImageLayerSettings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 200px;
  align-items: center;
}
.maskEditor_sidePanelLayer {
  display: flex;
  width: 200px;
  height: 50px;
}
.maskEditor_sidePanelLayerVisibilityContainer {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.maskEditor_sidePanelVisibilityToggle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  pointer-events: auto;
}
.maskEditor_sidePanelLayerIconContainer {
  width: 60px;
  height: 50px;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  fill: white;
}
.maskEditor_sidePanelLayerIconContainer svg {
  width: 30px;
  height: 30px;
}
#maskEditor_sidePanelMaskLayerBlendingContainer {
  width: 80px;
  height: 50px;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}
#maskEditor_sidePanelMaskLayerBlendingSelect {
  width: 80px;
  height: 30px;
  border: 1px solid var(--border-color);
  background-color: var(--p-surface-800);
  color: var(--input-text);
  font-family: sans-serif;
  font-size: 15px;
  pointer-events: auto;
  transition: background-color border 0.1s;
}
#maskEditor_sidePanelClearCanvasButton:hover {
  background-color: var(--p-overlaybadge-outline-color);
  border: none;
}
#maskEditor_sidePanelImageLayerImage {
  max-height: 90%;
  max-width: 50px;
}
#maskEditor_sidePanelClearCanvasButton {
  width: 180px;
  height: 30px;
  border: none;
  background: var(--p-surface-800);
  border: 1px solid var(--border-color);
  color: var(--input-text);
  font-family: sans-serif;
  font-size: 15px;
  pointer-events: auto;
  transition: background-color 0.1s;
}
#maskEditor_sidePanelClearCanvasButton:hover {
  background-color: var(--p-overlaybadge-outline-color);
}
#maskEditor_sidePanelHorizontalButtonContainer {
  display: flex;
  gap: 10px;
  height: 40px;
}
.maskEditor_sidePanelBigButton {
  width: 85px;
  height: 30px;
  border: none;
  background: var(--p-surface-800);
  border: 1px solid var(--border-color);
  color: var(--input-text);
  font-family: sans-serif;
  font-size: 15px;
  pointer-events: auto;
  transition: background-color border 0.1s;
}
.maskEditor_sidePanelBigButton:hover {
  background-color: var(--p-overlaybadge-outline-color);
  border: none;
}
#maskEditor_toolPanel {
  height: 100%;
  width: var(--sidebar-width);
  z-index: 8888;
  background: var(--comfy-menu-bg);
  display: flex;
  flex-direction: column;
}
.maskEditor_toolPanelContainer {
  width: var(--sidebar-width);
  height: var(--sidebar-width);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  transition: background-color border 0.2s;
}
.maskEditor_toolPanelContainer:hover {
  background-color: var(--p-overlaybadge-outline-color);
  border: none;
}
.maskEditor_toolPanelContainerSelected svg {
  fill: var(--p-button-text-primary-color) !important;
}
.maskEditor_toolPanelContainerSelected .maskEditor_toolPanelIndicator {
  display: block;
}
.maskEditor_toolPanelContainer svg {
  width: 75%;
  aspect-ratio: 1/1;
  fill: var(--p-button-text-secondary-color);
}
.maskEditor_toolPanelIndicator {
  display: none;
  height: 100%;
  width: 4px;
  position: absolute;
  left: 0;
  background: var(--p-button-text-primary-color);
}
#maskEditor_sidePanelPaintBucketSettings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 200px;
  padding: 10px;
}
#canvasBackground {
  position: absolute;
  background: white;
}

#maskEditor_sidePanelButtonsContainer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.maskEditor_sidePanelSeparator {
  width: 200px;
  height: 2px;
  background: var(--border-color);
  margin-top: 5px;
  margin-bottom: 5px;
}

#maskEditor_pointerZone {
  width: calc(100% - var(--sidebar-width) - 220px);
  height: 100%;
}

#maskEditor_uiContainer {
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 8888;
  display: flex;
}
`

var styleSheet = document.createElement('style')
styleSheet.type = 'text/css'
styleSheet.innerText = styles
document.head.appendChild(styleSheet)

// Helper function to convert a data URL to a Blob object
function dataURLToBlob(dataURL: string) {
  const parts = dataURL.split(';base64,')
  const contentType = parts[0].split(':')[1]
  const byteString = atob(parts[1])
  const arrayBuffer = new ArrayBuffer(byteString.length)
  const uint8Array = new Uint8Array(arrayBuffer)
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i)
  }
  return new Blob([arrayBuffer], { type: contentType })
}

function loadImage(imagePath: URL): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image() as HTMLImageElement
    image.onload = function () {
      resolve(image)
    }
    image.onerror = function (error) {
      reject(error)
    }
    image.src = imagePath.href
  })
}

async function uploadMask(
  filepath: { filename: string; subfolder: string; type: string },
  formData: FormData
) {
  await api
    .fetchApi('/upload/mask', {
      method: 'POST',
      body: formData
    })
    .then((response) => {})
    .catch((error) => {
      console.error('Error:', error)
    })

  ComfyApp.clipspace.imgs[ComfyApp.clipspace!['selectedIndex']] = new Image()
  ComfyApp.clipspace.imgs[ComfyApp.clipspace!['selectedIndex']].src =
    api.apiURL(
      '/view?' +
        new URLSearchParams(filepath).toString() +
        app.getPreviewFormatParam() +
        app.getRandParam()
    )

  if (ComfyApp.clipspace.images)
    ComfyApp.clipspace.images[ComfyApp.clipspace['selectedIndex']] = filepath

  ClipspaceDialog.invalidatePreview()
}

async function prepare_mask(
  image: HTMLImageElement,
  maskCanvas: HTMLCanvasElement,
  maskCtx: CanvasRenderingContext2D,
  maskColor: { r: number; g: number; b: number }
) {
  // paste mask data into alpha channel
  maskCtx.drawImage(image, 0, 0, maskCanvas.width, maskCanvas.height)
  const maskData = maskCtx.getImageData(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height
  )

  // invert mask
  for (let i = 0; i < maskData.data.length; i += 4) {
    const alpha = maskData.data[i + 3]
    maskData.data[i] = maskColor.r
    maskData.data[i + 1] = maskColor.g
    maskData.data[i + 2] = maskColor.b
    maskData.data[i + 3] = 255 - alpha
  }

  maskCtx.globalCompositeOperation = 'source-over'
  maskCtx.putImageData(maskData, 0, 0)
}

// Define the PointerType enum
enum PointerType {
  Arc = 'arc',
  Rect = 'rect'
}

enum Tools {
  Pen = 'pen',
  Eraser = 'eraser',
  PaintBucket = 'paintBucket'
}

enum CompositionOperation {
  SourceOver = 'source-over',
  DestinationOut = 'destination-out'
}

interface Point {
  x: number
  y: number
}

class MaskEditorDialog extends ComfyDialog {
  static instance: MaskEditorDialog | null = null
  static mousedown_x: number = 0
  static mousedown_y: number = 0

  brush!: HTMLDivElement
  maskCtx: any
  maskCanvas!: HTMLCanvasElement
  brush_size_slider!: HTMLInputElement
  brush_opacity_slider!: HTMLInputElement
  colorButton!: HTMLButtonElement
  saveButton!: HTMLButtonElement
  zoom_ratio: number = 1
  pan_x: number = 0
  pan_y: number = 0
  imgCanvas!: HTMLCanvasElement
  last_display_style: string = ''
  is_visible: boolean = false
  image!: HTMLImageElement
  sidebarImage!: HTMLImageElement
  handler_registered: boolean = false
  cursorX: number = 0
  cursorY: number = 0
  mousedown_pan_x: number = 0
  mousedown_pan_y: number = 0
  last_pressure: number = 0
  pointer_type: PointerType = PointerType.Arc
  isTouchZooming: boolean = false
  lastTouchZoomDistance: number = 0
  lastTouchX: number = 0
  lastTouchY: number = 0
  lastTouchMidX: number = 0
  lastTouchMidY: number = 0
  brush_opacity: number = 1.0
  brush_size: number = 10
  brush_hardness: number = 1.0
  brush_color_mode: string = 'black'
  drawing_mode: boolean = false
  smoothingCoords: Point | null = null
  smoothingCordsArray: Point[] = []
  smoothingLastDrawTime: Date | null = null

  isDrawing: boolean = false
  canvasHistory: any

  mouseOverSidePanel: boolean = false
  mouseOverCanvas: boolean = true

  isAdjustingBrush: boolean = false
  brushPreviewGradient!: HTMLDivElement
  brush_hardness_slider!: HTMLInputElement

  initialX: number = 0
  initialY: number = 0
  initialBrushSize: number = 0
  initialBrushHardness: number = 0

  mask_opacity: number = 0.7

  DOUBLE_TAP_DELAY: number = 300
  lastTwoFingerTap: number = 0

  currentTool: Tools = Tools.Pen
  toolPanel!: HTMLDivElement

  lineStartPoint: { x: number; y: number } | null = null
  isDrawingLine: boolean = false

  paintBucketTool: any
  paintBucketTolerance: number = 32

  brushSettingsHTML!: HTMLDivElement
  paintBucketSettingsHTML!: HTMLDivElement

  canvasBackground!: HTMLDivElement

  isSpacePressed: boolean = false
  pointerZone!: HTMLDivElement

  static getInstance() {
    if (!MaskEditorDialog.instance) {
      MaskEditorDialog.instance = new MaskEditorDialog()
    }

    return MaskEditorDialog.instance
  }

  is_layout_created = false

  constructor() {
    super()
    this.element = $el('div.maskEditor_hidden', { parent: document.body }, [])
  }

  setBrushBorderRadius(self: any): void {
    if (self.pointer_type === PointerType.Rect) {
      this.brush.style.borderRadius = '0%'
      // @ts-expect-error
      this.brush.style.MozBorderRadius = '0%'
      // @ts-expect-error
      this.brush.style.WebkitBorderRadius = '0%'
    } else {
      this.brush.style.borderRadius = '50%'
      // @ts-expect-error
      this.brush.style.MozBorderRadius = '50%'
      // @ts-expect-error
      this.brush.style.WebkitBorderRadius = '50%'
    }
  }

  createSidePanel() {
    const self = this

    var side_panel_container = document.createElement('div')
    side_panel_container.id = 'maskEditor_sidePanelContainer'

    //side panel

    var side_panel = document.createElement('div')
    side_panel.id = 'maskEditor_sidePanel'

    /// shortcuts

    var side_panel_shortcuts = document.createElement('div')
    side_panel_shortcuts.id = 'maskEditor_sidePanelShortcuts'

    var side_panel_undo_button = document.createElement('div')
    side_panel_undo_button.id = 'maskEditor_sidePanelUndoButton'
    side_panel_undo_button.classList.add('maskEditor_sidePanelIconButton')
    side_panel_undo_button.innerHTML =
      '<svg viewBox="0 0 15 15" style="width: 36px;height: 36px;pointer-events: none;fill: var(--input-text);"><path d="M8.77,12.18c-.25,0-.46-.2-.46-.46s.2-.46.46-.46c1.47,0,2.67-1.2,2.67-2.67,0-1.57-1.34-2.67-3.26-2.67h-3.98l1.43,1.43c.18.18.18.47,0,.64-.18.18-.47.18-.64,0l-2.21-2.21c-.18-.18-.18-.47,0-.64l2.21-2.21c.18-.18.47-.18.64,0,.18.18.18.47,0,.64l-1.43,1.43h3.98c2.45,0,4.17,1.47,4.17,3.58,0,1.97-1.61,3.58-3.58,3.58Z"></path> </svg>'

    side_panel_undo_button.addEventListener('click', () => {
      self.canvasHistory.undo()
    })

    var side_panel_redo_button = document.createElement('div')
    side_panel_redo_button.id = 'maskEditor_sidePanelRedoButton'
    side_panel_redo_button.classList.add('maskEditor_sidePanelIconButton')
    side_panel_redo_button.innerHTML =
      '<svg viewBox="0 0 15 15" style="width: 36px;height: 36px;pointer-events: none;fill: var(--input-text);"> <path class="cls-1" d="M6.23,12.18c-1.97,0-3.58-1.61-3.58-3.58,0-2.11,1.71-3.58,4.17-3.58h3.98l-1.43-1.43c-.18-.18-.18-.47,0-.64.18-.18.46-.18.64,0l2.21,2.21c.09.09.13.2.13.32s-.05.24-.13.32l-2.21,2.21c-.18.18-.47.18-.64,0-.18-.18-.18-.47,0-.64l1.43-1.43h-3.98c-1.92,0-3.26,1.1-3.26,2.67,0,1.47,1.2,2.67,2.67,2.67.25,0,.46.2.46.46s-.2.46-.46.46Z"/></svg>'

    side_panel_redo_button.addEventListener('click', () => {
      self.canvasHistory.redo()
    })

    side_panel_shortcuts.appendChild(side_panel_undo_button)
    side_panel_shortcuts.appendChild(side_panel_redo_button)

    /// brush settings

    var side_panel_brush_settings = document.createElement('div')
    side_panel_brush_settings.id = 'maskEditor_sidePanelBrushSettings'
    this.brushSettingsHTML = side_panel_brush_settings

    var side_panel_brush_settings_title = document.createElement('h3')
    side_panel_brush_settings_title.classList.add('maskEditor_sidePanelTitle')
    side_panel_brush_settings_title.innerText = 'Brush Settings'

    var side_panel_brush_settings_brush_shape_title =
      document.createElement('span')
    side_panel_brush_settings_brush_shape_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_brush_settings_brush_shape_title.innerText = 'Brush Shape'

    var side_panel_brush_settings_brush_shape_container =
      document.createElement('div')
    side_panel_brush_settings_brush_shape_container.id =
      'maskEditor_sidePanelBrushShapeContainer'

    const side_panel_brush_settings_brush_shape_circle =
      document.createElement('div')
    side_panel_brush_settings_brush_shape_circle.id =
      'maskEditor_sidePanelBrushShapeCircle'
    side_panel_brush_settings_brush_shape_circle.style.background =
      'var(--p-button-text-primary-color)'
    side_panel_brush_settings_brush_shape_circle.addEventListener(
      'click',
      () => {
        self.pointer_type = PointerType.Arc
        this.setBrushBorderRadius(self)
        side_panel_brush_settings_brush_shape_circle.style.background =
          'var(--p-button-text-primary-color)'
        side_panel_brush_settings_brush_shape_square.style.background = ''
      }
    )

    const side_panel_brush_settings_brush_shape_square =
      document.createElement('div')
    side_panel_brush_settings_brush_shape_square.id =
      'maskEditor_sidePanelBrushShapeSquare'
    side_panel_brush_settings_brush_shape_square.style.background = ''
    side_panel_brush_settings_brush_shape_square.addEventListener(
      'click',
      () => {
        self.pointer_type = PointerType.Rect
        this.setBrushBorderRadius(self)
        side_panel_brush_settings_brush_shape_square.style.background =
          'var(--p-button-text-primary-color)'
        side_panel_brush_settings_brush_shape_circle.style.background = ''
      }
    )

    side_panel_brush_settings_brush_shape_container.appendChild(
      side_panel_brush_settings_brush_shape_circle
    )
    side_panel_brush_settings_brush_shape_container.appendChild(
      side_panel_brush_settings_brush_shape_square
    )

    var side_panel_brush_settings_thickness_title =
      document.createElement('span')
    side_panel_brush_settings_thickness_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_brush_settings_thickness_title.innerText = 'Thickness'

    var side_panel_brush_settings_thickness_input =
      document.createElement('input')
    side_panel_brush_settings_thickness_input.setAttribute('type', 'range')
    side_panel_brush_settings_thickness_input.setAttribute('min', '1')
    side_panel_brush_settings_thickness_input.setAttribute('max', '100')
    side_panel_brush_settings_thickness_input.setAttribute('value', '10')

    side_panel_brush_settings_thickness_input.classList.add(
      'maskEditor_sidePanelBrushRange'
    )

    side_panel_brush_settings_thickness_input.addEventListener(
      'input',
      (event) => {
        self.brush_size = parseInt((event.target as HTMLInputElement)!.value)
        self.updateBrushPreview(self)
      }
    )

    this.brush_size_slider = side_panel_brush_settings_thickness_input

    var side_panel_brush_settings_opacity_title = document.createElement('span')
    side_panel_brush_settings_opacity_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_brush_settings_opacity_title.innerText = 'Opacity'

    var side_panel_brush_settings_opacity_input =
      document.createElement('input')
    side_panel_brush_settings_opacity_input.setAttribute('type', 'range')
    side_panel_brush_settings_opacity_input.setAttribute('min', '0.1')
    side_panel_brush_settings_opacity_input.setAttribute('max', '1')
    side_panel_brush_settings_opacity_input.setAttribute('step', '0.01')
    side_panel_brush_settings_opacity_input.setAttribute('value', '0.7')

    side_panel_brush_settings_opacity_input.classList.add(
      'maskEditor_sidePanelBrushRange'
    )

    side_panel_brush_settings_opacity_input.addEventListener(
      'input',
      (event) => {
        self.brush_opacity = parseFloat(
          (event.target as HTMLInputElement)!.value
        )
        self.updateBrushPreview(self)
      }
    )

    this.brush_opacity_slider = side_panel_brush_settings_opacity_input

    var side_panel_brush_settings_hardness_title =
      document.createElement('span')
    side_panel_brush_settings_hardness_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_brush_settings_hardness_title.innerText = 'Hardness'

    var side_panel_brush_settings_hardness_input =
      document.createElement('input')
    side_panel_brush_settings_hardness_input.setAttribute('type', 'range')
    side_panel_brush_settings_hardness_input.setAttribute('min', '0')
    side_panel_brush_settings_hardness_input.setAttribute('max', '1')
    side_panel_brush_settings_hardness_input.setAttribute('step', '0.01')
    side_panel_brush_settings_hardness_input.setAttribute('value', '1')

    side_panel_brush_settings_hardness_input.classList.add(
      'maskEditor_sidePanelBrushRange'
    )

    side_panel_brush_settings_hardness_input.addEventListener(
      'input',
      (event) => {
        self.brush_hardness = parseFloat(
          (event.target as HTMLInputElement)!.value
        )
        self.updateBrushPreview(self)
      }
    )

    this.brush_hardness_slider = side_panel_brush_settings_hardness_input

    side_panel_brush_settings.appendChild(side_panel_brush_settings_title)
    side_panel_brush_settings.appendChild(
      side_panel_brush_settings_brush_shape_title
    )
    side_panel_brush_settings.appendChild(
      side_panel_brush_settings_brush_shape_container
    )
    side_panel_brush_settings.appendChild(
      side_panel_brush_settings_thickness_title
    )
    side_panel_brush_settings.appendChild(
      side_panel_brush_settings_thickness_input
    )
    side_panel_brush_settings.appendChild(
      side_panel_brush_settings_opacity_title
    )
    side_panel_brush_settings.appendChild(
      side_panel_brush_settings_opacity_input
    )
    side_panel_brush_settings.appendChild(
      side_panel_brush_settings_hardness_title
    )
    side_panel_brush_settings.appendChild(
      side_panel_brush_settings_hardness_input
    )

    /// paint bucket settings

    var side_panel_paint_bucket_settings = document.createElement('div')
    side_panel_paint_bucket_settings.id =
      'maskEditor_sidePanelPaintBucketSettings'
    side_panel_paint_bucket_settings.style.display = 'none'
    this.paintBucketSettingsHTML = side_panel_paint_bucket_settings

    var side_panel_paint_bucket_settings_title = document.createElement('h3')
    side_panel_paint_bucket_settings_title.classList.add(
      'maskEditor_sidePanelTitle'
    )
    side_panel_paint_bucket_settings_title.innerText = 'Paint Bucket Settings'

    var side_panel_paint_bucket_settings_tolerance_title =
      document.createElement('span')
    side_panel_paint_bucket_settings_tolerance_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_paint_bucket_settings_tolerance_title.innerText = 'Tolerance'

    var side_panel_paint_bucket_settings_tolerance_input =
      document.createElement('input')
    side_panel_paint_bucket_settings_tolerance_input.setAttribute(
      'type',
      'range'
    )
    side_panel_paint_bucket_settings_tolerance_input.setAttribute('min', '0')
    side_panel_paint_bucket_settings_tolerance_input.setAttribute('max', '255')
    side_panel_paint_bucket_settings_tolerance_input.setAttribute(
      'value',
      String(this.paintBucketTolerance)
    )

    side_panel_paint_bucket_settings_tolerance_input.classList.add(
      'maskEditor_sidePanelBrushRange'
    )

    side_panel_paint_bucket_settings_tolerance_input.addEventListener(
      'input',
      (event) => {
        self.paintBucketTolerance = parseInt(
          (event.target as HTMLInputElement)!.value
        )
      }
    )

    side_panel_paint_bucket_settings.appendChild(
      side_panel_paint_bucket_settings_title
    )
    side_panel_paint_bucket_settings.appendChild(
      side_panel_paint_bucket_settings_tolerance_title
    )
    side_panel_paint_bucket_settings.appendChild(
      side_panel_paint_bucket_settings_tolerance_input
    )

    /// image layer settings

    var side_panel_image_layer_settings = document.createElement('div')
    side_panel_image_layer_settings.id =
      'maskEditor_sidePanelImageLayerSettings'

    var side_panel_image_layer_settings_title = document.createElement('h3')
    side_panel_image_layer_settings_title.classList.add(
      'maskEditor_sidePanelTitle'
    )
    side_panel_image_layer_settings_title.innerText = 'Layers'

    //// mask layer

    var side_panel_mask_layer_title = document.createElement('span')
    side_panel_mask_layer_title.classList.add('maskEditor_sidePanelSubTitle')
    side_panel_mask_layer_title.innerText = 'Mask Layer'

    var side_panel_mask_layer = document.createElement('div')
    side_panel_mask_layer.classList.add('maskEditor_sidePanelLayer')

    var side_panel_mask_layer_visibility_container =
      document.createElement('div')
    side_panel_mask_layer_visibility_container.classList.add(
      'maskEditor_sidePanelLayerVisibilityContainer'
    )

    var side_panel_mask_layer_visibility_toggle =
      document.createElement('input')
    side_panel_mask_layer_visibility_toggle.setAttribute('type', 'checkbox')
    side_panel_mask_layer_visibility_toggle.classList.add(
      'maskEditor_sidePanelVisibilityToggle'
    )
    side_panel_mask_layer_visibility_toggle.checked = true

    side_panel_mask_layer_visibility_toggle.addEventListener(
      'change',
      (event) => {
        if (!(event.target as HTMLInputElement)!.checked) {
          self.maskCanvas.style.opacity = '0'
        } else {
          self.maskCanvas.style.opacity = String(self.mask_opacity)
        }
      }
    )

    side_panel_mask_layer_visibility_container.appendChild(
      side_panel_mask_layer_visibility_toggle
    )

    var side_panel_mask_layer_icon_container = document.createElement('div')
    side_panel_mask_layer_icon_container.classList.add(
      'maskEditor_sidePanelLayerIconContainer'
    )
    side_panel_mask_layer_icon_container.innerHTML =
      '<svg viewBox="0 0 20 20" style="">   <path class="cls-1" d="M1.31,5.32v9.36c0,.55.45,1,1,1h15.38c.55,0,1-.45,1-1V5.32c0-.55-.45-1-1-1H2.31c-.55,0-1,.45-1,1ZM11.19,13.44c-2.91.94-5.57-1.72-4.63-4.63.34-1.05,1.19-1.9,2.24-2.24,2.91-.94,5.57,1.72,4.63,4.63-.34,1.05-1.19,1.9-2.24,2.24Z"/> </svg>'

    var side_panel_mask_layer_blending_container = document.createElement('div')
    side_panel_mask_layer_blending_container.id =
      'maskEditor_sidePanelMaskLayerBlendingContainer'

    var blending_options = ['black', 'white', 'negative']

    var side_panel_mask_layer_blending_select = document.createElement('select')
    side_panel_mask_layer_blending_select.id =
      'maskEditor_sidePanelMaskLayerBlendingSelect'
    blending_options.forEach((option) => {
      var option_element = document.createElement('option')
      option_element.value = option
      option_element.innerText = option
      side_panel_mask_layer_blending_select.appendChild(option_element)

      if (option == self.brush_color_mode) {
        option_element.selected = true
      }
    })

    side_panel_mask_layer_blending_select.addEventListener(
      'change',
      (event) => {
        self.brush_color_mode = (event.target as HTMLSelectElement)!.value
        self.updateWhenBrushColorModeChanged()
      }
    )

    side_panel_mask_layer_blending_container.appendChild(
      side_panel_mask_layer_blending_select
    )

    side_panel_mask_layer.appendChild(
      side_panel_mask_layer_visibility_container
    )
    side_panel_mask_layer.appendChild(side_panel_mask_layer_icon_container)
    side_panel_mask_layer.appendChild(side_panel_mask_layer_blending_container)

    var side_panel_mask_layer_opacity_title = document.createElement('span')
    side_panel_mask_layer_opacity_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_mask_layer_opacity_title.innerText = 'Mask Opacity'

    var side_panel_mask_layer_opacity_input = document.createElement('input')
    side_panel_mask_layer_opacity_input.setAttribute('type', 'range')
    side_panel_mask_layer_opacity_input.setAttribute('min', '0.0')
    side_panel_mask_layer_opacity_input.setAttribute('max', '1.0')
    side_panel_mask_layer_opacity_input.setAttribute('step', '0.01')
    side_panel_mask_layer_opacity_input.setAttribute(
      'value',
      String(this.mask_opacity)
    )
    side_panel_mask_layer_opacity_input.classList.add(
      'maskEditor_sidePanelBrushRange'
    )

    side_panel_mask_layer_opacity_input.addEventListener('input', (event) => {
      self.mask_opacity = parseFloat((event.target as HTMLInputElement)!.value)
      self.maskCanvas.style.opacity = String(self.mask_opacity)

      if (self.mask_opacity == 0) {
        side_panel_mask_layer_visibility_toggle.checked = false
      } else {
        side_panel_mask_layer_visibility_toggle.checked = true
      }
    })

    //// image layer

    var side_panel_image_layer_title = document.createElement('span')
    side_panel_image_layer_title.classList.add('maskEditor_sidePanelSubTitle')
    side_panel_image_layer_title.innerText = 'Image Layer'

    var side_panel_image_layer = document.createElement('div')
    side_panel_image_layer.classList.add('maskEditor_sidePanelLayer')

    var side_panel_image_layer_visibility_container =
      document.createElement('div')
    side_panel_image_layer_visibility_container.classList.add(
      'maskEditor_sidePanelLayerVisibilityContainer'
    )

    var side_panel_image_layer_visibility_toggle =
      document.createElement('input')
    side_panel_image_layer_visibility_toggle.setAttribute('type', 'checkbox')
    side_panel_image_layer_visibility_toggle.classList.add(
      'maskEditor_sidePanelVisibilityToggle'
    )
    side_panel_image_layer_visibility_toggle.checked = true

    side_panel_image_layer_visibility_toggle.addEventListener(
      'change',
      (event) => {
        if (!(event.target as HTMLInputElement)!.checked) {
          self.imgCanvas.style.opacity = '0'
        } else {
          self.imgCanvas.style.opacity = '1'
        }
      }
    )

    side_panel_image_layer_visibility_container.appendChild(
      side_panel_image_layer_visibility_toggle
    )

    var side_panel_image_layer_image_container = document.createElement('div')
    side_panel_image_layer_image_container.classList.add(
      'maskEditor_sidePanelLayerIconContainer'
    )

    var side_panel_image_layer_image = document.createElement('img')
    side_panel_image_layer_image.id = 'maskEditor_sidePanelImageLayerImage'
    side_panel_image_layer_image.src =
      ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']].src
    this.sidebarImage = side_panel_image_layer_image

    side_panel_image_layer_image_container.appendChild(
      side_panel_image_layer_image
    )

    side_panel_image_layer.appendChild(
      side_panel_image_layer_visibility_container
    )
    side_panel_image_layer.appendChild(side_panel_image_layer_image_container)

    side_panel_image_layer_settings.appendChild(
      side_panel_image_layer_settings_title
    )
    side_panel_image_layer_settings.appendChild(side_panel_mask_layer_title)
    side_panel_image_layer_settings.appendChild(side_panel_mask_layer)
    side_panel_image_layer_settings.appendChild(
      side_panel_mask_layer_opacity_title
    )
    side_panel_image_layer_settings.appendChild(
      side_panel_mask_layer_opacity_input
    )
    side_panel_image_layer_settings.appendChild(side_panel_image_layer_title)
    side_panel_image_layer_settings.appendChild(side_panel_image_layer)

    /// clear canvas button

    var side_panel_buttons_container = document.createElement('div')
    side_panel_buttons_container.id = 'maskEditor_sidePanelButtonsContainer'

    var side_panel_clear_canvas_button = document.createElement('button')
    side_panel_clear_canvas_button.id = 'maskEditor_sidePanelClearCanvasButton'
    side_panel_clear_canvas_button.innerText = 'Clear Canvas'

    side_panel_clear_canvas_button.addEventListener('click', () => {
      self.maskCtx.clearRect(
        0,
        0,
        self.maskCanvas.width,
        self.maskCanvas.height
      )
      this.canvasHistory.saveState()
    })

    var side_panel_button_container = document.createElement('div')
    side_panel_button_container.id =
      'maskEditor_sidePanelHorizontalButtonContainer'

    var side_panel_cancel_button = document.createElement('button')
    side_panel_cancel_button.classList.add('maskEditor_sidePanelBigButton')
    side_panel_cancel_button.innerText = 'Cancel'

    side_panel_cancel_button.addEventListener('click', () => {
      document.removeEventListener('keydown', (event: KeyboardEvent) =>
        MaskEditorDialog.handleKeyDown(self, event)
      )
      document.removeEventListener('keyup', (event: KeyboardEvent) =>
        MaskEditorDialog.handleKeyUp(self, event)
      )
      self.close()
    })

    var side_panel_save_button = document.createElement('button')
    side_panel_save_button.classList.add('maskEditor_sidePanelBigButton')
    side_panel_save_button.innerText = 'Save'

    this.saveButton = side_panel_save_button

    side_panel_save_button.addEventListener('click', () => {
      document.removeEventListener('keydown', (event: KeyboardEvent) =>
        MaskEditorDialog.handleKeyDown(self, event)
      )
      document.removeEventListener('keyup', (event: KeyboardEvent) =>
        MaskEditorDialog.handleKeyUp(self, event)
      )
      self.save()
    })

    side_panel_button_container.appendChild(side_panel_cancel_button)
    side_panel_button_container.appendChild(side_panel_save_button)

    side_panel_buttons_container.appendChild(side_panel_clear_canvas_button)
    side_panel_buttons_container.appendChild(side_panel_button_container)

    const side_panel_separator1 = document.createElement('div')
    side_panel_separator1.classList.add('maskEditor_sidePanelSeparator')

    const side_panel_separator2 = document.createElement('div')
    side_panel_separator2.classList.add('maskEditor_sidePanelSeparator')

    const side_panel_separator3 = document.createElement('div')
    side_panel_separator3.classList.add('maskEditor_sidePanelSeparator')

    side_panel.appendChild(side_panel_shortcuts)
    side_panel.appendChild(side_panel_separator1)
    side_panel.appendChild(side_panel_brush_settings)
    side_panel.appendChild(side_panel_paint_bucket_settings)
    side_panel.appendChild(side_panel_separator2)
    side_panel.appendChild(side_panel_image_layer_settings)
    side_panel.appendChild(side_panel_separator3)
    side_panel.appendChild(side_panel_buttons_container)

    side_panel_container.appendChild(side_panel)

    return side_panel_container
  }

  createToolPanel() {
    var pen_tool_panel = document.createElement('div')
    pen_tool_panel.id = 'maskEditor_toolPanel'
    this.toolPanel = pen_tool_panel

    var toolElements: HTMLElement[] = []

    //brush tool

    var toolPanel_brushToolContainer = document.createElement('div')
    toolPanel_brushToolContainer.classList.add('maskEditor_toolPanelContainer')
    toolPanel_brushToolContainer.classList.add(
      'maskEditor_toolPanelContainerSelected'
    )
    toolPanel_brushToolContainer.innerHTML = `
    <svg viewBox="0 0 44 44">
      <path class="cls-1" d="M34,13.93c0,.47-.19.94-.55,1.31l-13.02,13.04c-.09.07-.18.15-.27.22-.07-1.39-1.21-2.48-2.61-2.49.07-.12.16-.24.27-.34l13.04-13.04c.72-.72,1.89-.72,2.6,0,.35.35.55.83.55,1.3Z"/>
      <path class="cls-1" d="M19.64,29.03c0,4.46-6.46,3.18-9.64,0,3.3-.47,4.75-2.58,7.06-2.58,1.43,0,2.58,1.16,2.58,2.58Z"/>
    </svg>
    `
    toolElements.push(toolPanel_brushToolContainer)

    toolPanel_brushToolContainer.addEventListener('click', () => {
      this.currentTool = Tools.Pen
      for (let toolElement of toolElements) {
        if (toolElement != toolPanel_brushToolContainer) {
          toolElement.classList.remove('maskEditor_toolPanelContainerSelected')
        } else {
          toolElement.classList.add('maskEditor_toolPanelContainerSelected')
          this.brushSettingsHTML.style.display = 'flex'
          this.paintBucketSettingsHTML.style.display = 'none'
        }
      }

      this.pointerZone.style.cursor = 'none'
      this.brush.style.opacity = '1'
    })

    var toolPanel_brushToolIndicator = document.createElement('div')
    toolPanel_brushToolIndicator.classList.add('maskEditor_toolPanelIndicator')

    toolPanel_brushToolContainer.appendChild(toolPanel_brushToolIndicator)

    //eraser tool

    var toolPanel_eraserToolContainer = document.createElement('div')
    toolPanel_eraserToolContainer.classList.add('maskEditor_toolPanelContainer')
    toolPanel_eraserToolContainer.innerHTML = `
      <svg viewBox="0 0 44 44">
        <g>
          <rect class="cls-2" x="16.68" y="10" width="10.63" height="24" rx="1.16" ry="1.16" transform="translate(22 -9.11) rotate(45)"/>
          <path class="cls-1" d="M17.27,34.27c-.42,0-.85-.16-1.17-.48l-5.88-5.88c-.31-.31-.48-.73-.48-1.17s.17-.86.48-1.17l15.34-15.34c.62-.62,1.72-.62,2.34,0l5.88,5.88c.65.65.65,1.7,0,2.34l-15.34,15.34c-.32.32-.75.48-1.17.48ZM26.73,10.73c-.18,0-.34.07-.46.19l-15.34,15.34c-.12.12-.19.29-.19.46s.07.34.19.46l5.88,5.88c.26.26.67.26.93,0l15.34-15.34c.26-.26.26-.67,0-.93l-5.88-5.88c-.12-.12-.29-.19-.46-.19Z"/>
        </g>
        <path class="cls-3" d="M20.33,11.03h8.32c.64,0,1.16.52,1.16,1.16v15.79h-10.63v-15.79c0-.64.52-1.16,1.16-1.16Z" transform="translate(20.97 -11.61) rotate(45)"/>
      </svg>
    `
    toolElements.push(toolPanel_eraserToolContainer)

    toolPanel_eraserToolContainer.addEventListener('click', () => {
      this.currentTool = Tools.Eraser
      for (let toolElement of toolElements) {
        if (toolElement != toolPanel_eraserToolContainer) {
          toolElement.classList.remove('maskEditor_toolPanelContainerSelected')
        } else {
          toolElement.classList.add('maskEditor_toolPanelContainerSelected')
          this.brushSettingsHTML.style.display = 'flex'
          this.paintBucketSettingsHTML.style.display = 'none'
        }
      }

      this.pointerZone.style.cursor = 'none'
      this.brush.style.opacity = '1'
    })

    var toolPanel_eraserToolIndicator = document.createElement('div')
    toolPanel_eraserToolIndicator.classList.add('maskEditor_toolPanelIndicator')

    toolPanel_eraserToolContainer.appendChild(toolPanel_eraserToolIndicator)

    //paint bucket tool

    var toolPanel_paintBucketToolContainer = document.createElement('div')
    toolPanel_paintBucketToolContainer.classList.add(
      'maskEditor_toolPanelContainer'
    )
    toolPanel_paintBucketToolContainer.innerHTML = `
    <svg viewBox="0 0 44 44">
      <path class="cls-1" d="M33.4,21.76l-11.42,11.41-.04.05c-.61.61-1.6.61-2.21,0l-8.91-8.91c-.61-.61-.61-1.6,0-2.21l.04-.05.3-.29h22.24Z"/>
      <path class="cls-1" d="M20.83,34.17c-.55,0-1.07-.21-1.46-.6l-8.91-8.91c-.8-.8-.8-2.11,0-2.92l11.31-11.31c.8-.8,2.11-.8,2.92,0l8.91,8.91c.39.39.6.91.6,1.46s-.21,1.07-.6,1.46l-11.31,11.31c-.39.39-.91.6-1.46.6ZM23.24,10.83c-.27,0-.54.1-.75.31l-11.31,11.31c-.41.41-.41,1.09,0,1.5l8.91,8.91c.4.4,1.1.4,1.5,0l11.31-11.31c.2-.2.31-.47.31-.75s-.11-.55-.31-.75l-8.91-8.91c-.21-.21-.48-.31-.75-.31Z"/>
      <path class="cls-1" d="M34.28,26.85c0,.84-.68,1.52-1.52,1.52s-1.52-.68-1.52-1.52,1.52-2.86,1.52-2.86c0,0,1.52,2.02,1.52,2.86Z"/>
    </svg>
    `
    toolElements.push(toolPanel_paintBucketToolContainer)

    toolPanel_paintBucketToolContainer.addEventListener('click', () => {
      this.currentTool = Tools.PaintBucket
      for (let toolElement of toolElements) {
        if (toolElement != toolPanel_paintBucketToolContainer) {
          toolElement.classList.remove('maskEditor_toolPanelContainerSelected')
        } else {
          toolElement.classList.add('maskEditor_toolPanelContainerSelected')
          this.brushSettingsHTML.style.display = 'none'
          this.paintBucketSettingsHTML.style.display = 'flex'
        }
      }

      this.pointerZone.style.cursor = "url('/cursor/paintBucket.png'), auto"
      this.brush.style.opacity = '0'
    })

    var toolPanel_paintBucketToolIndicator = document.createElement('div')
    toolPanel_paintBucketToolIndicator.classList.add(
      'maskEditor_toolPanelIndicator'
    )

    toolPanel_paintBucketToolContainer.appendChild(
      toolPanel_paintBucketToolIndicator
    )

    pen_tool_panel.appendChild(toolPanel_brushToolContainer)
    pen_tool_panel.appendChild(toolPanel_eraserToolContainer)
    pen_tool_panel.appendChild(toolPanel_paintBucketToolContainer)

    var pen_tool_panel_change_tool_button = document.createElement('button')
    pen_tool_panel_change_tool_button.id =
      'maskEditor_toolPanelChangeToolButton'
    pen_tool_panel_change_tool_button.innerText = 'change to Eraser'

    return pen_tool_panel
  }

  createPointerZone() {
    const self = this

    const pointer_zone = document.createElement('div')
    pointer_zone.id = 'maskEditor_pointerZone'

    this.pointerZone = pointer_zone

    pointer_zone.addEventListener('pointerdown', (event: PointerEvent) => {
      this.handlePointerDown(self, event)
    })

    pointer_zone.addEventListener('pointermove', (event: PointerEvent) => {
      this.handlePointerMove(self, event)
    })

    pointer_zone.addEventListener('pointerup', (event: PointerEvent) => {
      this.handlePointerUp(self, event)
    })

    pointer_zone.addEventListener('pointerleave', (event: PointerEvent) => {
      this.brush.style.opacity = '0'
      this.pointerZone.style.cursor = ''
    })

    pointer_zone.addEventListener('pointerenter', (event: PointerEvent) => {
      if (this.currentTool == Tools.PaintBucket) {
        this.pointerZone.style.cursor = "url('/cursor/paintBucket.png'), auto"
        this.brush.style.opacity = '0'
      } else {
        this.pointerZone.style.cursor = 'none'
        this.brush.style.opacity = '1'
      }
    })

    return pointer_zone
  }

  screenToCanvas(
    clientX: number,
    clientY: number
  ): { x: number; x_unscaled: number; y: number; y_unscaled: number } {
    // Get the bounding rectangles for both elements
    const canvasRect = this.maskCanvas.getBoundingClientRect()
    const pointerZoneRect = this.pointerZone.getBoundingClientRect()

    // Calculate the offset between pointer zone and canvas
    const offsetX = pointerZoneRect.left - canvasRect.left
    const offsetY = pointerZoneRect.top - canvasRect.top

    const x_unscaled = clientX + offsetX
    const y_unscaled = clientY + offsetY

    const x = x_unscaled / this.zoom_ratio
    const y = y_unscaled / this.zoom_ratio

    return { x: x, x_unscaled: x_unscaled, y: y, y_unscaled: y_unscaled }
  }

  setEventHandler(maskCanvas: HTMLCanvasElement) {
    const self = this

    if (!this.handler_registered) {
      maskCanvas.addEventListener('contextmenu', (event: Event) => {
        event.preventDefault()
      })

      this.element.addEventListener('contextmenu', (event: Event) => {
        event.preventDefault()
      })

      this.element.addEventListener('wheel', (event) =>
        this.handleWheelEvent(self, event)
      )

      maskCanvas.addEventListener(
        'touchstart',
        this.handleTouchStart.bind(this)
      )
      maskCanvas.addEventListener('touchmove', this.handleTouchMove.bind(this))
      maskCanvas.addEventListener('touchend', this.handleTouchEnd.bind(this))

      this.element.addEventListener('dragstart', (event) => {
        if (event.ctrlKey) {
          event.preventDefault()
        }
      })

      this.handler_registered = true
    }
  }

  createUI() {
    var ui_container = document.createElement('div')
    ui_container.id = 'maskEditor_uiContainer'

    var side_panel_container = this.createSidePanel()

    var pointer_zone = this.createPointerZone()

    var tool_panel = this.createToolPanel()

    ui_container.appendChild(tool_panel)
    ui_container.appendChild(pointer_zone)
    ui_container.appendChild(side_panel_container)

    return ui_container
  }

  setlayout(imgCanvas: HTMLCanvasElement, maskCanvas: HTMLCanvasElement) {
    const self = this
    self.pointer_type = PointerType.Arc

    var user_ui = this.createUI()

    var brush = document.createElement('div')
    brush.id = 'brush'
    brush.style.backgroundColor = 'transparent'
    brush.style.outline = '1px dashed black'
    brush.style.boxShadow = '0 0 0 1px white'
    brush.style.position = 'absolute'
    brush.style.zIndex = '8889'
    brush.style.pointerEvents = 'none'
    brush.style.borderRadius = '50%'
    brush.style.overflow = 'visible'

    var brush_preview_gradient = document.createElement('div')
    brush_preview_gradient.style.position = 'absolute'
    brush_preview_gradient.style.width = '100%'
    brush_preview_gradient.style.height = '100%'
    brush_preview_gradient.style.borderRadius = '50%'
    brush_preview_gradient.style.display = 'none'

    brush.appendChild(brush_preview_gradient)

    var canvas_background = document.createElement('div')
    canvas_background.id = 'canvasBackground'

    this.canvasBackground = canvas_background

    this.brush = brush
    this.brushPreviewGradient = brush_preview_gradient
    this.setBrushBorderRadius(self)
    this.element.appendChild(imgCanvas)
    this.element.appendChild(maskCanvas)
    this.element.appendChild(canvas_background)
    this.element.appendChild(user_ui)
    document.body.appendChild(brush)

    this.element.appendChild(imgCanvas)
    this.element.appendChild(maskCanvas)

    imgCanvas.style.position = 'absolute'
    maskCanvas.style.position = 'absolute'

    imgCanvas.style.top = '200'
    imgCanvas.style.left = '0'

    maskCanvas.style.top = imgCanvas.style.top
    maskCanvas.style.left = imgCanvas.style.left

    const maskCanvasStyle = this.getMaskCanvasStyle()
    maskCanvas.style.mixBlendMode = maskCanvasStyle.mixBlendMode
    maskCanvas.style.opacity = maskCanvasStyle.opacity.toString()
  }

  async show() {
    this.zoom_ratio = 1.0
    this.pan_x = 0
    this.pan_y = 0

    document.body.addEventListener('contextmenu', this.disableContextMenu, {
      capture: true
    })

    if (!this.is_layout_created) {
      // layout
      const imgCanvas = document.createElement('canvas')
      const maskCanvas = document.createElement('canvas')

      imgCanvas.id = 'imageCanvas'
      maskCanvas.id = 'maskCanvas'

      this.setlayout(imgCanvas, maskCanvas)

      // prepare content
      this.imgCanvas = imgCanvas
      this.maskCanvas = maskCanvas
      this.maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })

      this.canvasHistory = new CanvasHistory(maskCanvas, this.maskCtx)

      this.paintBucketTool = new PaintBucketTool(this.maskCanvas, this.maskCtx)

      this.setEventHandler(maskCanvas)

      this.is_layout_created = true

      // replacement of onClose hook since close is not real close
      const self = this
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'style'
          ) {
            if (
              self.last_display_style &&
              self.last_display_style != 'none' &&
              self.element.style.display == 'none'
            ) {
              //self.brush.style.display = 'none'
              ComfyApp.onClipspaceEditorClosed()
            }

            self.last_display_style = self.element.style.display
          }
        })
      })

      const config = { attributes: true }
      observer.observe(this.element, config)
    }

    // The keydown event needs to be reconfigured when closing the dialog as it gets removed.
    document.addEventListener('keydown', (event: KeyboardEvent) =>
      MaskEditorDialog.handleKeyDown(this, event)
    )
    document.addEventListener('keyup', (event: KeyboardEvent) =>
      MaskEditorDialog.handleKeyUp(this, event)
    )

    this.saveButton.innerText = 'Save'
    this.saveButton.disabled = false

    this.element.id = 'maskEditor'
    this.element.style.display = 'flex'
    await this.setImages(this.imgCanvas)
    this.canvasHistory.clearStates()
    await new Promise((resolve) => setTimeout(resolve, 50))
    this.canvasHistory.saveInitialState()

    this.is_visible = true

    this.sidebarImage.src =
      ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']].src
  }

  isOpened() {
    return this.element.style.display == 'block'
  }

  async invalidateCanvas(
    orig_image: HTMLImageElement,
    mask_image: HTMLImageElement
  ) {
    this.imgCanvas.width = orig_image.width
    this.imgCanvas.height = orig_image.height

    this.maskCanvas.width = orig_image.width
    this.maskCanvas.height = orig_image.height

    let imgCtx = this.imgCanvas.getContext('2d', { willReadFrequently: true })
    let maskCtx = this.maskCanvas.getContext('2d', {
      willReadFrequently: true
    })

    imgCtx!.drawImage(orig_image, 0, 0, orig_image.width, orig_image.height)
    await prepare_mask(
      mask_image,
      this.maskCanvas,
      maskCtx!,
      this.getMaskColor()
    )
  }

  async setImages(imgCanvas: HTMLCanvasElement) {
    let self = this

    const imgCtx = imgCanvas.getContext('2d', { willReadFrequently: true })
    const maskCtx = this.maskCtx
    const maskCanvas = this.maskCanvas

    imgCtx!.clearRect(0, 0, this.imgCanvas.width, this.imgCanvas.height)
    maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height)

    // image load
    const filepath = ComfyApp.clipspace.images

    const alpha_url = new URL(
      ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']].src
    )
    alpha_url.searchParams.delete('channel')
    alpha_url.searchParams.delete('preview')
    alpha_url.searchParams.set('channel', 'a')
    let mask_image: HTMLImageElement = await loadImage(alpha_url)

    // original image load
    const rgb_url = new URL(
      ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']].src
    )
    rgb_url.searchParams.delete('channel')
    rgb_url.searchParams.set('channel', 'rgb')
    this.image = new Image()

    this.image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = rgb_url.toString()
    })

    maskCanvas.width = self.image.width
    maskCanvas.height = self.image.height

    await self.invalidateCanvas(self.image, mask_image)
    self.initializeCanvasPanZoom()
  }

  initializeCanvasPanZoom() {
    // set initialize
    let drawWidth = this.image.width
    let drawHeight = this.image.height

    let width = this.element.clientWidth
    let height = this.element.clientHeight

    if (this.image.width > width) {
      drawWidth = width
      drawHeight = (drawWidth / this.image.width) * this.image.height
    }

    if (drawHeight > height) {
      drawHeight = height
      drawWidth = (drawHeight / this.image.height) * this.image.width
    }

    this.zoom_ratio = drawWidth / this.image.width

    const canvasX = (width - drawWidth) / 2
    const canvasY = (height - drawHeight) / 2
    this.pan_x = canvasX
    this.pan_y = canvasY

    this.invalidatePanZoom()
  }

  invalidatePanZoom() {
    let raw_width = this.image.width * this.zoom_ratio
    let raw_height = this.image.height * this.zoom_ratio
    if (this.pan_x + raw_width < 10) {
      this.pan_x = 10 - raw_width
    }
    if (this.pan_y + raw_height < 10) {
      this.pan_y = 10 - raw_height
    }
    let width = `${raw_width}px`
    let height = `${raw_height}px`
    let left = `${this.pan_x}px`
    let top = `${this.pan_y}px`
    this.maskCanvas.style.width = width
    this.maskCanvas.style.height = height
    this.maskCanvas.style.left = left
    this.maskCanvas.style.top = top
    this.imgCanvas.style.width = width
    this.imgCanvas.style.height = height
    this.imgCanvas.style.left = left
    this.imgCanvas.style.top = top
    this.canvasBackground.style.width = width
    this.canvasBackground.style.height = height
    this.canvasBackground.style.left = left
    this.canvasBackground.style.top = top
  }

  getMaskCanvasStyle() {
    if (this.brush_color_mode === 'negative') {
      return {
        mixBlendMode: 'difference',
        opacity: '1'
      }
    } else {
      return {
        mixBlendMode: 'initial',
        opacity: this.mask_opacity
      }
    }
  }

  getMaskColor() {
    if (this.brush_color_mode === 'black') {
      return { r: 0, g: 0, b: 0 }
    }
    if (this.brush_color_mode === 'white') {
      return { r: 255, g: 255, b: 255 }
    }
    if (this.brush_color_mode === 'negative') {
      // negative effect only works with white color
      return { r: 255, g: 255, b: 255 }
    }

    return { r: 0, g: 0, b: 0 }
  }

  getMaskFillStyle() {
    const maskColor = this.getMaskColor()

    return 'rgb(' + maskColor.r + ',' + maskColor.g + ',' + maskColor.b + ')'
  }

  setCanvasBackground() {
    if (this.brush_color_mode === 'white') {
      this.canvasBackground.style.background = 'black'
    } else {
      this.canvasBackground.style.background = 'white'
    }
  }

  updateWhenBrushColorModeChanged() {
    // update mask canvas css styles
    const maskCanvasStyle = this.getMaskCanvasStyle()
    this.maskCanvas.style.mixBlendMode = maskCanvasStyle.mixBlendMode
    this.maskCanvas.style.opacity = maskCanvasStyle.opacity.toString()

    // update mask canvas rgb colors
    const maskColor = this.getMaskColor()
    this.maskCtx.fillStyle = `rgb(${maskColor.r}, ${maskColor.g}, ${maskColor.b})`

    //set canvas background color
    this.setCanvasBackground()

    const maskData = this.maskCtx.getImageData(
      0,
      0,
      this.maskCanvas.width,
      this.maskCanvas.height
    )
    for (let i = 0; i < maskData.data.length; i += 4) {
      maskData.data[i] = maskColor.r
      maskData.data[i + 1] = maskColor.g
      maskData.data[i + 2] = maskColor.b
    }
    this.maskCtx.putImageData(maskData, 0, 0)
  }

  static handleKeyDown(self: MaskEditorDialog, event: KeyboardEvent) {
    if (event.key === ']') {
      self.brush_size = Math.min(self.brush_size + 2, 100)
      self.brush_size_slider.value = self.brush_size.toString()
    } else if (event.key === '[') {
      self.brush_size = Math.max(self.brush_size - 2, 1)
      self.brush_size_slider.value = self.brush_size.toString()
    } else if (event.key === 'Enter') {
      self.save()
    } else if (event.key === ' ') {
      self.isSpacePressed = true
    }

    // Check if user presses ctrl + z or cmd + z
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      self.canvasHistory.undo()
    }

    // Check if user presses ctrl + shift + z or cmd + shift + z
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.key === 'Z'
    ) {
      self.canvasHistory.redo()
    }

    self.updateBrushPreview(self)
  }

  static handleKeyUp(self: MaskEditorDialog, event: KeyboardEvent) {
    if (event.key === ' ') {
      self.isSpacePressed = false
    }
  }

  static handlePointerUp(event: PointerEvent) {
    event.preventDefault()
    this.mousedown_x = 0
    this.mousedown_y = 0

    MaskEditorDialog.instance!.drawing_mode = false
  }

  updateBrushPreview(self: MaskEditorDialog) {
    const centerX = self.cursorX + self.pan_x
    const centerY = self.cursorY + self.pan_y
    const brush = self.brush
    const hardness = self.brush_hardness
    const extendedSize = self.brush_size * (2 - hardness) * 2 * this.zoom_ratio

    brush.style.width = extendedSize + 'px'
    brush.style.height = extendedSize + 'px'
    brush.style.left = centerX - extendedSize / 2 + 'px'
    brush.style.top = centerY - extendedSize / 2 + 'px'

    if (hardness === 1) {
      self.brushPreviewGradient.style.background = 'rgba(255, 0, 0, 0.5)'
      return
    }

    const opacityStop = hardness / 4 + 0.25

    self.brushPreviewGradient.style.background = `
        radial-gradient(
            circle,
            rgba(255, 0, 0, 0.5) 0%,
            rgba(255, 0, 0, ${opacityStop}) ${hardness * 100}%,
            rgba(255, 0, 0, 0) 100%
        )
    `
  }

  handleWheelEvent(self: MaskEditorDialog, event: WheelEvent) {
    // zoom canvas
    const oldZoom = this.zoom_ratio
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    this.zoom_ratio = Math.max(
      0.2,
      Math.min(10.0, this.zoom_ratio * zoomFactor)
    )
    const newZoom = this.zoom_ratio

    // Get mouse position relative to the container
    const rect = self.maskCanvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    // Calculate new pan position
    const scaleFactor = newZoom / oldZoom
    this.pan_x += mouseX - mouseX * scaleFactor
    this.pan_y += mouseY - mouseY * scaleFactor

    this.invalidatePanZoom()

    // Update cursor position with new pan values
    this.updateCursorPosition(this, event.clientX, event.clientY)
    this.updateBrushPreview(this)
  }

  pointMoveEvent(self: MaskEditorDialog, event: PointerEvent) {
    if (event.pointerType == 'touch') return
    this.cursorX = event.pageX
    this.cursorY = event.pageY
    //self.updateBrushPreview(self)
  }

  pan_move(self: MaskEditorDialog, event: PointerEvent) {
    if (MaskEditorDialog.mousedown_x) {
      let deltaX = MaskEditorDialog.mousedown_x! - event.clientX
      let deltaY = MaskEditorDialog.mousedown_y! - event.clientY

      self.pan_x = this.mousedown_pan_x - deltaX
      self.pan_y = this.mousedown_pan_y - deltaY
      self.invalidatePanZoom()
    }
  }

  handleTouchStart(event: TouchEvent) {
    event.preventDefault()
    if ((event.touches[0] as any).touchType === 'stylus') return
    if (event.touches.length === 2) {
      const currentTime = new Date().getTime()
      const tapTimeDiff = currentTime - this.lastTwoFingerTap

      if (tapTimeDiff < this.DOUBLE_TAP_DELAY) {
        // Double tap detected
        this.handleDoubleTap()
        this.lastTwoFingerTap = 0 // Reset to prevent triple-tap
      } else {
        this.lastTwoFingerTap = currentTime

        // Existing two-finger touch logic
        this.isTouchZooming = true
        this.lastTouchZoomDistance = this.getTouchDistance(event.touches)
        const midpoint = this.getTouchMidpoint(event.touches)
        this.lastTouchMidX = midpoint.x
        this.lastTouchMidY = midpoint.y
      }
    } else if (event.touches.length === 1) {
      this.lastTouchX = event.touches[0].clientX
      this.lastTouchY = event.touches[0].clientY
    }
  }

  handleTouchMove(event: TouchEvent) {
    event.preventDefault()
    if ((event.touches[0] as any).touchType === 'stylus') return

    this.lastTwoFingerTap = 0
    if (this.isTouchZooming && event.touches.length === 2) {
      const newDistance = this.getTouchDistance(event.touches)
      const zoomFactor = newDistance / this.lastTouchZoomDistance
      const oldZoom = this.zoom_ratio
      this.zoom_ratio = Math.max(
        0.2,
        Math.min(10.0, this.zoom_ratio * zoomFactor)
      )
      const newZoom = this.zoom_ratio

      // Calculate the midpoint of the two touches
      const midpoint = this.getTouchMidpoint(event.touches)
      const midX = midpoint.x
      const midY = midpoint.y

      // Get touch position relative to the container
      const rect = this.maskCanvas.getBoundingClientRect()
      const touchX = midX - rect.left
      const touchY = midY - rect.top

      // Calculate new pan position based on zoom
      const scaleFactor = newZoom / oldZoom
      this.pan_x += touchX - touchX * scaleFactor
      this.pan_y += touchY - touchY * scaleFactor

      // Calculate additional pan based on touch movement
      if (this.lastTouchMidX !== null && this.lastTouchMidY !== null) {
        const panDeltaX = midX - this.lastTouchMidX
        const panDeltaY = midY - this.lastTouchMidY
        this.pan_x += panDeltaX
        this.pan_y += panDeltaY
      }

      this.invalidatePanZoom()
      this.lastTouchZoomDistance = newDistance
      this.lastTouchMidX = midX
      this.lastTouchMidY = midY
    } else if (event.touches.length === 1) {
      // Handle single touch pan
      this.handleSingleTouchPan(event.touches[0])
    }
  }

  handleTouchEnd(event: TouchEvent) {
    event.preventDefault()
    if (
      event.touches.length === 0 &&
      (event.touches[0] as any).touchType === 'stylus'
    )
      return

    this.isTouchZooming = false
    this.lastTouchMidX = 0
    this.lastTouchMidY = 0

    if (event.touches.length === 0) {
      this.lastTouchX = 0
      this.lastTouchY = 0
    } else if (event.touches.length === 1) {
      this.lastTouchX = event.touches[0].clientX
      this.lastTouchY = event.touches[0].clientY
    }
  }

  handleDoubleTap() {
    this.canvasHistory.undo()
    // Add any additional logic needed after undo
  }

  getTouchDistance(touches: TouchList) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  getTouchMidpoint(touches: TouchList) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    }
  }

  handleSingleTouchPan(touch: Touch) {
    if (this.lastTouchX === null || this.lastTouchY === null) {
      this.lastTouchX = touch.clientX
      this.lastTouchY = touch.clientY
      return
    }

    const deltaX = touch.clientX - this.lastTouchX
    const deltaY = touch.clientY - this.lastTouchY

    this.pan_x += deltaX
    this.pan_y += deltaY

    this.invalidatePanZoom()

    this.lastTouchX = touch.clientX
    this.lastTouchY = touch.clientY
  }

  handlePointerMove(self: MaskEditorDialog, event: PointerEvent) {
    event.preventDefault()
    if (event.pointerType == 'touch') return
    self.updateCursorPosition(self, event.clientX, event.clientY)

    //move the canvas
    if (event.buttons === 4 || (event.buttons === 1 && this.isSpacePressed)) {
      self.pan_move(self, event)
      return
    }

    //prevent drawing with paint bucket tool
    if (this.currentTool === Tools.PaintBucket) return

    self.updateBrushPreview(self)

    // alt + right mouse button hold brush adjustment
    if (
      self.isAdjustingBrush &&
      (this.currentTool === Tools.Pen || this.currentTool === Tools.Eraser) &&
      event.altKey &&
      event.buttons === 2
    ) {
      this.handleBrushAdjustment(self, event)
      return
    }

    //draw with pen or eraser
    if (event.buttons == 1 || event.buttons == 2) {
      var diff = performance.now() - self.smoothingLastDrawTime.getTime()

      let coords_canvas = self.screenToCanvas(event.offsetX, event.offsetY)

      console.log(coords_canvas)

      var brush_size = this.brush_size
      var brush_hardness = this.brush_hardness
      var brush_opacity = this.brush_opacity

      if (event instanceof PointerEvent && event.pointerType == 'pen') {
        brush_size *= event.pressure
        this.last_pressure = event.pressure
      } else {
        brush_size = this.brush_size //this is the problem with pen pressure
      }

      //not sure what this does
      if (diff > 20 && !this.drawing_mode)
        requestAnimationFrame(() => {
          self.init_shape(self, CompositionOperation.SourceOver)
          self.draw_shape(
            self,
            coords_canvas.x,
            coords_canvas.y,
            brush_size,
            brush_hardness,
            brush_opacity
          )
          this.smoothingCoords = { x: coords_canvas.x, y: coords_canvas.y }
          this.smoothingCordsArray = [
            { x: coords_canvas.x, y: coords_canvas.y }
          ]
        })
      else
        requestAnimationFrame(() => {
          if (this.currentTool === Tools.Eraser) {
            self.init_shape(self, CompositionOperation.DestinationOut)
          } else if (event.buttons == 2) {
            self.init_shape(self, CompositionOperation.DestinationOut)
          } else {
            self.init_shape(self, CompositionOperation.SourceOver)
          }

          //use drawWithSmoothing for better performance or change step in drawWithBetterSmoothing
          this.drawWithBetterSmoothing(
            self,
            coords_canvas.x,
            coords_canvas.y,
            brush_size,
            brush_hardness,
            brush_opacity
          )
        })

      this.smoothingLastDrawTime = new Date()
    }
  }

  handleBrushAdjustment(self: MaskEditorDialog, event: PointerEvent) {
    const delta_x = event.clientX - self.initialX!
    const delta_y = event.clientY - self.initialY!

    // Adjust brush size (horizontal movement)
    const newSize = Math.max(
      1,
      Math.min(100, self.initialBrushSize! + delta_x / 5)
    )
    self.brush_size = newSize
    self.brush_size_slider.value = newSize.toString()

    // Adjust brush hardness (vertical movement)
    const newHardness = Math.max(
      0,
      Math.min(1, self.initialBrushHardness! - delta_y / 200)
    )
    self.brush_hardness = newHardness
    self.brush_hardness_slider.value = newHardness.toString()

    self.updateBrushPreview(self)
    return
  }

  //maybe remove this function
  drawWithSmoothing(
    self: MaskEditorDialog,
    clientX: number,
    clientY: number,
    brush_size: number,
    brush_hardness: number,
    brush_opacity: number
  ) {
    // Get current canvas coordinates
    if (this.smoothingCoords) {
      // Calculate distance in screen coordinates
      const dx = clientX - this.smoothingCoords.x
      const dy = clientY - this.smoothingCoords.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      console.log(distance)

      if (distance > 0) {
        const step = 0.1
        const steps = Math.ceil(distance / step)
        const stepSize = distance / steps

        for (let i = 0; i < steps; i++) {
          const x = this.smoothingCoords.x + dx * (i / steps)
          const y = this.smoothingCoords.y + dy * (i / steps)
          self.draw_shape(self, x, y, brush_size, brush_hardness, brush_opacity)
        }
      }
    }

    // Store current screen coordinates for next time
    this.smoothingCoords = { x: clientX, y: clientY }

    // Draw the final point
    self.draw_shape(
      self,
      clientX,
      clientY,
      brush_size,
      brush_hardness,
      brush_opacity
    )
  }

  drawWithBetterSmoothing(
    self: MaskEditorDialog,
    clientX: number,
    clientY: number,
    brush_size: number,
    brush_hardness: number,
    brush_opacity: number
  ) {
    // Add current point to the smoothing array
    if (!this.smoothingCordsArray) {
      this.smoothingCordsArray = []
    }

    this.smoothingCordsArray.push({ x: clientX, y: clientY })

    // Keep a moving window of points for the spline
    const MAX_POINTS = 5
    if (this.smoothingCordsArray.length > MAX_POINTS) {
      this.smoothingCordsArray.shift()
    }

    // Need at least 3 points for cubic spline interpolation
    if (this.smoothingCordsArray.length >= 3) {
      const dx = clientX - this.smoothingCordsArray[0].x
      const dy = clientY - this.smoothingCordsArray[0].y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const step = 2
      const steps = Math.ceil(distance / step)

      // Generate interpolated points
      const interpolatedPoints = this.calculateCubicSplinePoints(
        this.smoothingCordsArray,
        steps // number of segments between each pair of control points
      )

      // Draw all interpolated points
      for (const point of interpolatedPoints) {
        self.draw_shape(
          self,
          point.x,
          point.y,
          brush_size,
          brush_hardness,
          brush_opacity
        )
      }
    } else {
      // If we don't have enough points yet, just draw the current point
      self.draw_shape(
        self,
        clientX,
        clientY,
        brush_size,
        brush_hardness,
        brush_opacity
      )
    }
  }

  calculateCubicSplinePoints(
    points: Point[],
    numSegments: number = 10
  ): Point[] {
    const result: Point[] = []

    const xCoords = points.map((p) => p.x)
    const yCoords = points.map((p) => p.y)

    const xDerivatives = this.calculateSplineCoefficients(xCoords)
    const yDerivatives = this.calculateSplineCoefficients(yCoords)

    // Generate points along the spline
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const d0x = xDerivatives[i]
      const d1x = xDerivatives[i + 1]
      const d0y = yDerivatives[i]
      const d1y = yDerivatives[i + 1]

      for (let t = 0; t <= numSegments; t++) {
        const t_normalized = t / numSegments

        // Hermite basis functions
        const h00 = 2 * t_normalized ** 3 - 3 * t_normalized ** 2 + 1
        const h10 = t_normalized ** 3 - 2 * t_normalized ** 2 + t_normalized
        const h01 = -2 * t_normalized ** 3 + 3 * t_normalized ** 2
        const h11 = t_normalized ** 3 - t_normalized ** 2

        const x = h00 * p0.x + h10 * d0x + h01 * p1.x + h11 * d1x
        const y = h00 * p0.y + h10 * d0y + h01 * p1.y + h11 * d1y

        result.push({ x, y })
      }
    }

    return result
  }

  calculateSplineCoefficients(values: number[]): number[] {
    const n = values.length - 1
    const matrix: number[][] = new Array(n + 1)
      .fill(0)
      .map(() => new Array(n + 1).fill(0))
    const rhs: number[] = new Array(n + 1).fill(0)

    // Set up tridiagonal matrix
    for (let i = 1; i < n; i++) {
      matrix[i][i - 1] = 1
      matrix[i][i] = 4
      matrix[i][i + 1] = 1
      rhs[i] = 3 * (values[i + 1] - values[i - 1])
    }

    // Set boundary conditions (natural spline)
    matrix[0][0] = 2
    matrix[0][1] = 1
    matrix[n][n - 1] = 1
    matrix[n][n] = 2
    rhs[0] = 3 * (values[1] - values[0])
    rhs[n] = 3 * (values[n] - values[n - 1])

    // Solve tridiagonal system using Thomas algorithm
    for (let i = 1; i <= n; i++) {
      const m = matrix[i][i - 1] / matrix[i - 1][i - 1]
      matrix[i][i] -= m * matrix[i - 1][i]
      rhs[i] -= m * rhs[i - 1]
    }

    const solution: number[] = new Array(n + 1)
    solution[n] = rhs[n] / matrix[n][n]
    for (let i = n - 1; i >= 0; i--) {
      solution[i] = (rhs[i] - matrix[i][i + 1] * solution[i + 1]) / matrix[i][i]
    }

    return solution
  }

  updateCursorPosition(
    self: MaskEditorDialog,
    clientX: number,
    clientY: number
  ) {
    self.cursorX = clientX - self.pan_x
    self.cursorY = clientY - self.pan_y
  }

  disableContextMenu(event: Event) {
    event.preventDefault()
    event.stopPropagation()
  }

  handlePointerDown(self: MaskEditorDialog, event: PointerEvent) {
    event.preventDefault()
    if (event.pointerType == 'touch') return

    // Pan canvas
    if (event.buttons === 4 || (event.buttons === 1 && this.isSpacePressed)) {
      MaskEditorDialog.mousedown_x = event.clientX
      MaskEditorDialog.mousedown_y = event.clientY
      this.brush.style.opacity = '0'
      this.pointerZone.style.cursor = 'grabbing'
      self.mousedown_pan_x = self.pan_x
      self.mousedown_pan_y = self.pan_y
      return
    }

    //paint bucket
    if (this.currentTool === Tools.PaintBucket && event.button === 0) {
      console.log('paint bucket')
      let coords_canvas = self.screenToCanvas(event.offsetX, event.offsetY)
      this.handlePaintBucket(coords_canvas)
      return
    }

    // Start drawing
    this.isDrawing = true
    var brush_size = this.brush_size
    var brush_hardness = this.brush_hardness
    var brush_opacity = this.brush_opacity
    let coords_canvas = self.screenToCanvas(event.offsetX, event.offsetY)
    if (event.pointerType == 'pen') {
      brush_size *= event.pressure
      this.last_pressure = event.pressure

      this.toolPanel.style.display = 'flex'
    }

    // (brush resize/change hardness) Check for alt + right mouse button
    if (event.altKey && event.button === 2) {
      self.brushPreviewGradient.style.display = ''
      self.initialX = event.clientX
      self.initialY = event.clientY
      self.initialBrushSize = self.brush_size
      self.initialBrushHardness = self.brush_hardness
      self.isAdjustingBrush = true
      event.preventDefault()
      return
    }

    //drawing
    if ([0, 2].includes(event.button)) {
      self.drawing_mode = true
      let compositionOp: CompositionOperation

      //set drawing mode
      if (this.currentTool === Tools.Eraser) {
        compositionOp = CompositionOperation.DestinationOut //eraser
      } else if (event.button === 2) {
        compositionOp = CompositionOperation.DestinationOut //eraser
      } else {
        compositionOp = CompositionOperation.SourceOver //pen
      }

      //check if user wants to draw line or free draw
      if (event.shiftKey && this.lineStartPoint) {
        this.isDrawingLine = true
        const p2 = { x: coords_canvas.x, y: coords_canvas.y }
        this.drawLine(
          self,
          this.lineStartPoint,
          p2,
          brush_size,
          brush_hardness,
          brush_opacity,
          compositionOp
        )
      } else {
        self.init_shape(self, compositionOp)
        self.draw_shape(
          self,
          coords_canvas.x,
          coords_canvas.y,
          brush_size,
          brush_hardness,
          brush_opacity
        )
      }
      this.lineStartPoint = { x: coords_canvas.x, y: coords_canvas.y }
      this.smoothingCoords = { x: coords_canvas.x, y: coords_canvas.y } //maybe remove this
      this.smoothingCordsArray = [{ x: coords_canvas.x, y: coords_canvas.y }] //used to smooth the drawing line
      this.smoothingLastDrawTime = new Date()
    }
  }

  handlePaintBucket(point: Point) {
    console.log(point)
    this.paintBucketTool.floodFill(point.x, point.y, this.paintBucketTolerance)
  }

  init_shape(self: MaskEditorDialog, compositionOperation) {
    self.maskCtx.beginPath()
    if (compositionOperation == CompositionOperation.SourceOver) {
      self.maskCtx.fillStyle = this.getMaskFillStyle()
      self.maskCtx.globalCompositeOperation = CompositionOperation.SourceOver
    } else if (compositionOperation == CompositionOperation.DestinationOut) {
      self.maskCtx.globalCompositeOperation =
        CompositionOperation.DestinationOut
    }
  }

  drawLine(
    self: MaskEditorDialog,
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    brush_size: number,
    brush_hardness: number,
    brush_opacity: number,
    compositionOp: CompositionOperation
  ) {
    const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    const steps = Math.ceil(distance / (brush_size / 4)) // Adjust for smoother lines

    self.init_shape(self, compositionOp)

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = p1.x + (p2.x - p1.x) * t
      const y = p1.y + (p2.y - p1.y) * t
      self.draw_shape(self, x, y, brush_size, brush_hardness, brush_opacity)
    }
  }

  draw_shape(
    self: MaskEditorDialog,
    x: number,
    y: number,
    brush_size: number,
    hardness: number,
    opacity: number
  ) {
    hardness = isNaN(hardness) ? 1 : Math.max(0, Math.min(1, hardness))
    // Extend the gradient radius beyond the brush size
    const extendedSize = brush_size * (2 - hardness)

    let gradient = self.maskCtx.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      extendedSize
    )

    // Get the current mask color based on the blending mode
    const maskColor = self.getMaskColor()

    const isErasing =
      self.maskCtx.globalCompositeOperation === 'destination-out'

    if (hardness === 1) {
      gradient.addColorStop(
        0,
        isErasing
          ? `rgba(255, 255, 255, ${opacity})`
          : `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`
      )
      gradient.addColorStop(
        1,
        isErasing
          ? `rgba(255, 255, 255, ${opacity})`
          : `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`
      )
    } else {
      let softness = 1 - hardness
      let innerStop = Math.max(0, hardness - softness)
      let outerStop = brush_size / extendedSize

      if (isErasing) {
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`)
        gradient.addColorStop(innerStop, `rgba(255, 255, 255, ${opacity})`)
        gradient.addColorStop(outerStop, `rgba(255, 255, 255, ${opacity / 2})`)
        gradient.addColorStop(1, `rgba(255, 255, 255, 0)`)
      } else {
        gradient.addColorStop(
          0,
          `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`
        )
        gradient.addColorStop(
          innerStop,
          `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`
        )
        gradient.addColorStop(
          outerStop,
          `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity / 2})`
        )
        gradient.addColorStop(
          1,
          `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, 0)`
        )
      }
    }

    self.maskCtx.fillStyle = gradient
    self.maskCtx.beginPath()
    if (self.pointer_type === PointerType.Rect) {
      self.maskCtx.rect(
        x - extendedSize,
        y - extendedSize,
        extendedSize * 2,
        extendedSize * 2
      )
    } else {
      self.maskCtx.arc(x, y, extendedSize, 0, Math.PI * 2, false)
    }
    self.maskCtx.fill()
  }

  handlePointerUp(self: MaskEditorDialog, event: PointerEvent) {
    if (event.pointerType === 'touch') return
    if (this.currentTool === Tools.PaintBucket) {
      this.pointerZone.style.cursor = "url('/cursor/paintBucket.png'), auto"
      this.brush.style.opacity = '0'
    } else {
      this.pointerZone.style.cursor = 'none'
      this.brush.style.opacity = '1'
      this.updateBrushPreview(this)
    }

    this.isAdjustingBrush = false
    this.brushPreviewGradient.style.display = 'none'

    MaskEditorDialog.handlePointerUp(event)
    if (this.isDrawing) {
      this.isDrawing = false
      this.canvasHistory.saveState()
      const coords_canvas = self.screenToCanvas(event.offsetX, event.offsetY)
      this.lineStartPoint = coords_canvas
      console.log(coords_canvas)
    }
  }

  async save() {
    const backupCanvas = document.createElement('canvas')
    const backupCtx = backupCanvas.getContext('2d', {
      willReadFrequently: true
    })
    backupCanvas.width = this.image.width
    backupCanvas.height = this.image.height

    if (!backupCtx) {
      console.log('Failed to save mask. Please try again.')
      return
    }

    backupCtx.clearRect(0, 0, backupCanvas.width, backupCanvas.height)
    backupCtx.drawImage(
      this.maskCanvas,
      0,
      0,
      this.maskCanvas.width,
      this.maskCanvas.height,
      0,
      0,
      backupCanvas.width,
      backupCanvas.height
    )

    // paste mask data into alpha channel
    const backupData = backupCtx.getImageData(
      0,
      0,
      backupCanvas.width,
      backupCanvas.height
    )

    // refine mask image
    for (let i = 0; i < backupData.data.length; i += 4) {
      const alpha = backupData.data[i + 3]
      backupData.data[i] = 0
      backupData.data[i + 1] = 0
      backupData.data[i + 2] = 0
      backupData.data[i + 3] = 255 - alpha
    }

    backupCtx.globalCompositeOperation = CompositionOperation.SourceOver
    backupCtx.putImageData(backupData, 0, 0)

    const formData = new FormData()
    const filename = 'clipspace-mask-' + performance.now() + '.png'

    const item = {
      filename: filename,
      subfolder: 'clipspace',
      type: 'input'
    }

    if (ComfyApp.clipspace.images) ComfyApp.clipspace.images[0] = item

    if (ComfyApp.clipspace.widgets) {
      const index = ComfyApp.clipspace.widgets.findIndex(
        (obj) => obj.name === 'image'
      )

      if (index >= 0) ComfyApp.clipspace.widgets[index].value = item
    }

    const dataURL = backupCanvas.toDataURL()
    const blob = dataURLToBlob(dataURL)

    let original_url = new URL(this.image.src)

    type Ref = { filename: string; subfolder?: string; type?: string }

    const original_ref: Ref = {
      filename: original_url.searchParams.get('filename')
    }

    let original_subfolder = original_url.searchParams.get('subfolder')
    if (original_subfolder) original_ref.subfolder = original_subfolder

    let original_type = original_url.searchParams.get('type')
    if (original_type) original_ref.type = original_type

    formData.append('image', blob, filename)
    formData.append('original_ref', JSON.stringify(original_ref))
    formData.append('type', 'input')
    formData.append('subfolder', 'clipspace')

    this.saveButton.innerText = 'Saving...'
    this.saveButton.disabled = true
    await uploadMask(item, formData)
    ComfyApp.onClipspaceEditorSave()
    this.close()
  }
}

class CanvasHistory {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  states: ImageData[]
  currentStateIndex: number
  maxStates: number
  initialized: boolean

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    maxStates = 20
  ) {
    this.canvas = canvas
    this.ctx = ctx
    this.states = []
    this.currentStateIndex = -1
    this.maxStates = maxStates
    this.initialized = false
  }

  clearStates() {
    this.states = []
    this.currentStateIndex = -1
    this.initialized = false
  }

  saveInitialState() {
    if (!this.canvas.width || !this.canvas.height) {
      // Canvas not ready yet, defer initialization
      requestAnimationFrame(() => this.saveInitialState())
      return
    }

    this.clearStates()
    const state = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    )

    this.states.push(state)
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
    const state = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    )
    this.states.push(state)
    this.currentStateIndex++

    if (this.states.length > this.maxStates) {
      this.states.shift()
      this.currentStateIndex--
    }
  }

  undo() {
    if (this.currentStateIndex >= 0) {
      this.currentStateIndex--
      this.restoreState(this.states[this.currentStateIndex])
    } else {
      alert('No more undo states')
    }
  }

  redo() {
    if (this.currentStateIndex < this.states.length - 1) {
      this.currentStateIndex++
      this.restoreState(this.states[this.currentStateIndex])
    } else {
      alert('No more redo states')
    }
  }

  restoreState(state: ImageData) {
    if (state && this.initialized) {
      this.ctx.putImageData(state, 0, 0)
    }
  }
}

class PaintBucketTool {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number

  constructor(maskCanvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = maskCanvas
    this.ctx = ctx
    this.width = maskCanvas.width
    this.height = maskCanvas.height
  }

  // Get the color/alpha value at a specific pixel
  getPixel(imageData: ImageData, x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1
    const index = (y * this.width + x) * 4
    // For mask, we only care about alpha channel
    //log rgba values for debugging
    return imageData.data[index + 3]
  }

  // Set the color/alpha value at a specific pixel
  setPixel(imageData: ImageData, x: number, y: number, alpha: number) {
    const index = (y * this.width + x) * 4
    imageData.data[index] = 0 // R
    imageData.data[index + 1] = 0 // G
    imageData.data[index + 2] = 0 // B
    imageData.data[index + 3] = alpha // A
  }

  // Main flood fill function
  floodFill(startX: number, startY: number, tolerance = 32) {
    this.width = this.canvas.width
    this.height = this.canvas.height

    const imageData = this.ctx.getImageData(0, 0, this.width, this.height)
    const targetAlpha = this.getPixel(imageData, startX, startY)

    // If clicking on a fully opaque pixel, return
    if (targetAlpha === 255) return

    // Queue for processing pixels
    const queue = []
    queue.push([startX, startY])

    // Keep track of visited pixels
    const visited = new Set()
    const key = (x: number, y: number) => `${x},${y}`

    while (queue.length > 0) {
      const [x, y] = queue.pop()
      const currentKey = key(x, y)

      if (visited.has(currentKey)) continue
      visited.add(currentKey)

      const currentAlpha = this.getPixel(imageData, x, y)

      // Check if pixel should be filled
      if (currentAlpha === -1) continue // Out of bounds
      if (Math.abs(currentAlpha - targetAlpha) > tolerance) continue

      // Fill the pixel
      this.setPixel(imageData, x, y, 255)

      // Add neighboring pixels to queue
      queue.push([x + 1, y]) // Right
      queue.push([x - 1, y]) // Left
      queue.push([x, y + 1]) // Down
      queue.push([x, y - 1]) // Up
    }

    // Update the canvas with filled region
    this.ctx.putImageData(imageData, 0, 0)
  }
}

app.registerExtension({
  name: 'Comfy.MaskEditor',
  init(app) {
    ComfyApp.open_maskeditor = function () {
      const dlg = MaskEditorDialog.getInstance()
      if (!dlg.isOpened()) {
        dlg.show()
      }
    }

    const context_predicate = () =>
      ComfyApp.clipspace &&
      ComfyApp.clipspace.imgs &&
      ComfyApp.clipspace.imgs.length > 0
    ClipspaceDialog.registerButton(
      'MaskEditor',
      context_predicate,
      ComfyApp.open_maskeditor
    )
  }
})
