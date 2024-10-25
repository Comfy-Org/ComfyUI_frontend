import { app, Clipspace } from '../../scripts/app'
import { ComfyDialog, $el } from '../../scripts/ui'
import { ComfyApp } from '../../scripts/app'
import { api } from '../../scripts/api'
import { ClipspaceDialog } from './clipspace'
import { RGB } from '@/utils/colorUtil'

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

function loadImage(imagePath: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = function () {
      resolve(image)
    }

    image.src = imagePath
  })
}

async function uploadMask(
  filepath: {
    filename: string
    subfolder: string
    type: string
  },
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

  if (ComfyApp.clipspace?.imgs) {
    ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']] = new Image()
    ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']].src =
      api.apiURL(
        '/view?' +
          new URLSearchParams(filepath).toString() +
          app.getPreviewFormatParam() +
          app.getRandParam()
      )
  }

  if (ComfyApp.clipspace?.images)
    ComfyApp.clipspace.images[ComfyApp.clipspace['selectedIndex']] = filepath

  ClipspaceDialog.invalidatePreview()
}

function prepare_mask(
  image: HTMLImageElement,
  maskCanvas: HTMLCanvasElement,
  maskCtx: CanvasRenderingContext2D,
  maskColor: RGB
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
    if (maskData.data[i + 3] == 255) maskData.data[i + 3] = 0
    else maskData.data[i + 3] = 255

    maskData.data[i] = maskColor.r
    maskData.data[i + 1] = maskColor.g
    maskData.data[i + 2] = maskColor.b
  }

  maskCtx.globalCompositeOperation = 'source-over'
  maskCtx.putImageData(maskData, 0, 0)
}

// Define the PointerType enum
enum PointerType {
  Arc = 'arc',
  Rect = 'rect'
}

enum CompositionOperation {
  SourceOver = 'source-over',
  DestinationOut = 'destination-out'
}

class MaskEditorDialog extends ComfyDialog {
  static instance: MaskEditorDialog | null
  static mousedown_x: number | null = null
  static mousedown_y: number | null = null

  brush?: HTMLDivElement
  maskCtx?: CanvasRenderingContext2D
  maskCanvas = document.createElement('canvas')
  brush_size_slider?: HTMLDivElement
  brush_opacity_slider?: HTMLDivElement
  colorButton?: HTMLButtonElement
  saveButton?: HTMLButtonElement
  zoom_lasty?: number
  zoom_ratio: number = 1
  last_zoom_ratio: number = 1
  pan_x: number = 0
  pan_y: number = 0
  imgCanvas = document.createElement('canvas')
  last_display_style: string = ''
  is_visible: boolean = false
  image?: HTMLImageElement
  handler_registered: boolean = false
  brush_slider_input = document.createElement('input')
  opacity_slider_input?: HTMLInputElement
  cursorX?: number
  cursorY?: number
  mousedown_pan_x?: number
  mousedown_pan_y?: number
  last_pressure: number = 1
  pointer_type?: PointerType
  brush_pointer_type_select?: HTMLDivElement

  static getInstance() {
    if (!MaskEditorDialog.instance) {
      MaskEditorDialog.instance = new MaskEditorDialog()
    }

    return MaskEditorDialog.instance
  }

  is_layout_created = false

  constructor() {
    super()
    this.element = $el('div.comfy-modal', { parent: document.body }, [
      $el('div.comfy-modal-content', [...this.createButtons()])
    ])
  }

  createButtons() {
    return []
  }

  createButton(
    name: string,
    callback: (e: MouseEvent) => void
  ): HTMLButtonElement {
    var button = document.createElement('button')
    button.style.pointerEvents = 'auto'
    button.innerText = name
    button.addEventListener('click', callback)
    return button
  }

  createLeftButton(name: string, callback: (e: MouseEvent) => void) {
    var button = this.createButton(name, callback)
    button.style.cssFloat = 'left'
    button.style.marginRight = '4px'
    return button
  }

  createRightButton(name: string, callback: (e: MouseEvent) => void) {
    var button = this.createButton(name, callback)
    button.style.cssFloat = 'right'
    button.style.marginLeft = '4px'
    return button
  }

  createLeftSlider(
    self: MaskEditorDialog,
    name: string,
    callback: (e: Event) => void
  ): HTMLDivElement {
    const divElement = document.createElement('div')
    divElement.id = 'maskeditor-slider'
    divElement.style.cssFloat = 'left'
    divElement.style.fontFamily = 'sans-serif'
    divElement.style.marginRight = '4px'
    divElement.style.color = 'var(--input-text)'
    divElement.style.backgroundColor = 'var(--comfy-input-bg)'
    divElement.style.borderRadius = '8px'
    divElement.style.borderColor = 'var(--border-color)'
    divElement.style.borderStyle = 'solid'
    divElement.style.fontSize = '15px'
    divElement.style.height = '25px'
    divElement.style.padding = '1px 6px'
    divElement.style.display = 'flex'
    divElement.style.position = 'relative'
    divElement.style.top = '2px'
    divElement.style.pointerEvents = 'auto'
    self.brush_slider_input.setAttribute('type', 'range')
    self.brush_slider_input.setAttribute('min', '1')
    self.brush_slider_input.setAttribute('max', '100')
    self.brush_slider_input.setAttribute('value', '10')
    const labelElement = document.createElement('label')
    labelElement.textContent = name

    divElement.appendChild(labelElement)
    divElement.appendChild(self.brush_slider_input)

    self.brush_slider_input.addEventListener('change', callback)

    return divElement
  }

  createOpacitySlider(
    self: MaskEditorDialog,
    name: string,
    callback: (e: Event) => void
  ): HTMLDivElement {
    const divElement = document.createElement('div')
    divElement.id = 'maskeditor-opacity-slider'
    divElement.style.cssFloat = 'left'
    divElement.style.fontFamily = 'sans-serif'
    divElement.style.marginRight = '4px'
    divElement.style.color = 'var(--input-text)'
    divElement.style.backgroundColor = 'var(--comfy-input-bg)'
    divElement.style.borderRadius = '8px'
    divElement.style.borderColor = 'var(--border-color)'
    divElement.style.borderStyle = 'solid'
    divElement.style.fontSize = '15px'
    divElement.style.height = '25px'
    divElement.style.padding = '1px 6px'
    divElement.style.display = 'flex'
    divElement.style.position = 'relative'
    divElement.style.top = '2px'
    divElement.style.pointerEvents = 'auto'
    self.opacity_slider_input = document.createElement('input')
    self.opacity_slider_input.setAttribute('type', 'range')
    self.opacity_slider_input.setAttribute('min', '0.1')
    self.opacity_slider_input.setAttribute('max', '1.0')
    self.opacity_slider_input.setAttribute('step', '0.01')
    self.opacity_slider_input.setAttribute('value', '0.7')
    const labelElement = document.createElement('label')
    labelElement.textContent = name

    divElement.appendChild(labelElement)
    divElement.appendChild(self.opacity_slider_input)

    self.opacity_slider_input.addEventListener('input', callback)

    return divElement
  }

  createPointerTypeSelect(self: any): HTMLDivElement {
    const divElement = document.createElement('div')
    divElement.id = 'maskeditor-pointer-type'
    divElement.style.cssFloat = 'left'
    divElement.style.fontFamily = 'sans-serif'
    divElement.style.marginRight = '4px'
    divElement.style.color = 'var(--input-text)'
    divElement.style.backgroundColor = 'var(--comfy-input-bg)'
    divElement.style.borderRadius = '8px'
    divElement.style.borderColor = 'var(--border-color)'
    divElement.style.borderStyle = 'solid'
    divElement.style.fontSize = '15px'
    divElement.style.height = '25px'
    divElement.style.padding = '1px 6px'
    divElement.style.display = 'flex'
    divElement.style.position = 'relative'
    divElement.style.top = '2px'
    divElement.style.pointerEvents = 'auto'

    const labelElement = document.createElement('label')
    labelElement.textContent = 'Pointer Type:'

    const selectElement = document.createElement('select')
    selectElement.style.borderRadius = '0'
    selectElement.style.borderColor = 'transparent'
    selectElement.style.borderStyle = 'unset'
    selectElement.style.fontSize = '0.9em'

    const optionArc = document.createElement('option')
    optionArc.value = 'arc'
    optionArc.text = 'Circle'
    optionArc.selected = true // Fix for TypeScript, "selected" should be boolean

    const optionRect = document.createElement('option')
    optionRect.value = 'rect'
    optionRect.text = 'Square'

    selectElement.appendChild(optionArc)
    selectElement.appendChild(optionRect)

    selectElement.addEventListener('change', (event: Event) => {
      const target = event.target as HTMLSelectElement
      self.pointer_type = target.value
      this.setBrushBorderRadius(self)
    })

    divElement.appendChild(labelElement)
    divElement.appendChild(selectElement)

    return divElement
  }

  setBrushBorderRadius(self: MaskEditorDialog): void {
    if (self.pointer_type === PointerType.Rect) {
      this.brush!.style.borderRadius = '0%'
      // @ts-expect-error
      this.brush!.style.MozBorderRadius = '0%'
      // @ts-expect-error
      this.brush!.style.WebkitBorderRadius = '0%'
    } else {
      this.brush!.style.borderRadius = '50%'
      // @ts-expect-error
      this.brush!.style.MozBorderRadius = '50%'
      // @ts-expect-error
      this.brush!.style.WebkitBorderRadius = '50%'
    }
  }

  setlayout(imgCanvas: HTMLCanvasElement, maskCanvas: HTMLCanvasElement) {
    const self = this
    self.pointer_type = PointerType.Arc

    // If it is specified as relative, using it only as a hidden placeholder for padding is recommended
    // to prevent anomalies where it exceeds a certain size and goes outside of the window.
    var bottom_panel = document.createElement('div')
    bottom_panel.style.position = 'absolute'
    bottom_panel.style.bottom = '0px'
    bottom_panel.style.left = '20px'
    bottom_panel.style.right = '20px'
    bottom_panel.style.height = '50px'
    bottom_panel.style.pointerEvents = 'none'

    var brush = document.createElement('div')
    brush.id = 'brush'
    brush.style.backgroundColor = 'transparent'
    brush.style.outline = '1px dashed black'
    brush.style.boxShadow = '0 0 0 1px white'
    brush.style.position = 'absolute'
    brush.style.zIndex = '8889'
    brush.style.pointerEvents = 'none'
    this.brush = brush
    this.setBrushBorderRadius(self)
    this.element.appendChild(imgCanvas)
    this.element.appendChild(maskCanvas)
    this.element.appendChild(bottom_panel)
    document.body.appendChild(brush)

    var clearButton = this.createLeftButton('Clear', () => {
      self.maskCtx!.clearRect(
        0,
        0,
        self.maskCanvas.width,
        self.maskCanvas.height
      )
    })

    this.brush_size_slider = this.createLeftSlider(
      self,
      'Thickness',
      (event) => {
        self.brush_size = Number((event.target as HTMLInputElement).value)
        self.updateBrushPreview(self)
      }
    )

    this.brush_opacity_slider = this.createOpacitySlider(
      self,
      'Opacity',
      (event) => {
        self.brush_opacity = Number((event.target as HTMLInputElement).value)
        if (self.brush_color_mode !== 'negative') {
          self.maskCanvas.style.opacity = self.brush_opacity.toString()
        }
      }
    )

    this.brush_pointer_type_select = this.createPointerTypeSelect(self)
    this.colorButton = this.createLeftButton(this.getColorButtonText(), () => {
      if (self.brush_color_mode === 'black') {
        self.brush_color_mode = 'white'
      } else if (self.brush_color_mode === 'white') {
        self.brush_color_mode = 'negative'
      } else {
        self.brush_color_mode = 'black'
      }

      self.updateWhenBrushColorModeChanged()
    })

    var cancelButton = this.createRightButton('Cancel', () => {
      document.removeEventListener('keydown', MaskEditorDialog.handleKeyDown)
      self.close()
    })

    this.saveButton = this.createRightButton('Save', () => {
      document.removeEventListener('keydown', MaskEditorDialog.handleKeyDown)
      self.save()
    })

    this.element.appendChild(imgCanvas)
    this.element.appendChild(maskCanvas)
    this.element.appendChild(bottom_panel)

    bottom_panel.appendChild(clearButton)
    bottom_panel.appendChild(this.saveButton)
    bottom_panel.appendChild(cancelButton)
    bottom_panel.appendChild(this.brush_size_slider)
    bottom_panel.appendChild(this.brush_opacity_slider)
    bottom_panel.appendChild(this.brush_pointer_type_select)
    bottom_panel.appendChild(this.colorButton)

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

    if (!this.is_layout_created) {
      // layout
      this.imgCanvas.id = 'imageCanvas'
      this.maskCanvas.id = 'maskCanvas'

      this.setlayout(this.imgCanvas, this.maskCanvas)

      // prepare content
      this.maskCtx = this.maskCanvas.getContext('2d', {
        willReadFrequently: true
      }) as CanvasRenderingContext2D

      this.setEventHandler(this.maskCanvas)

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
              self.brush!.style.display = 'none'
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
    document.addEventListener('keydown', MaskEditorDialog.handleKeyDown)

    if (ComfyApp.clipspace_return_node) {
      this.saveButton!.innerText = 'Save to node'
    } else {
      this.saveButton!.innerText = 'Save'
    }
    this.saveButton!.disabled = false

    this.element.style.display = 'block'
    this.element.style.width = '85%'
    this.element.style.margin = '0 7.5%'
    this.element.style.height = '100vh'
    this.element.style.top = '50%'
    this.element.style.left = '42%'
    this.element.style.zIndex = '8888' // NOTE: alert dialog must be high priority.

    await this.setImages(this.imgCanvas)

    this.is_visible = true
  }

  isOpened() {
    return this.element.style.display == 'block'
  }

  invalidateCanvas(orig_image: HTMLImageElement, mask_image: HTMLImageElement) {
    this.imgCanvas.width = orig_image.width
    this.imgCanvas.height = orig_image.height

    this.maskCanvas.width = orig_image.width
    this.maskCanvas.height = orig_image.height

    let imgCtx = this.imgCanvas.getContext('2d', { willReadFrequently: true })
    let maskCtx = this.maskCanvas.getContext('2d', {
      willReadFrequently: true
    })
    if (!imgCtx || !maskCtx) {
      throw new Error('Failed to get context')
    }

    imgCtx.drawImage(orig_image, 0, 0, orig_image.width, orig_image.height)
    prepare_mask(mask_image, this.maskCanvas, maskCtx!, this.getMaskColor())
  }

  async setImages(imgCanvas: HTMLCanvasElement) {
    let self = this

    const imgCtx = imgCanvas.getContext('2d', { willReadFrequently: true })
    const maskCtx = this.maskCtx
    if (!imgCtx || !maskCtx) {
      throw new Error('Failed to get context')
    }
    if (!ComfyApp.clipspace) {
      throw new Error('Missing clipspace')
    }
    const maskCanvas = this.maskCanvas

    imgCtx.clearRect(0, 0, this.imgCanvas.width, this.imgCanvas.height)
    maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height)

    const alpha_url = new URL(
      ComfyApp.clipspace?.imgs?.[ComfyApp.clipspace?.['selectedIndex']]?.src ??
        ''
    )
    alpha_url.searchParams.delete('channel')
    alpha_url.searchParams.delete('preview')
    alpha_url.searchParams.set('channel', 'a')
    let mask_image = await loadImage(alpha_url.toString())

    // original image load
    const rgb_url = new URL(
      ComfyApp.clipspace?.imgs?.[ComfyApp.clipspace?.['selectedIndex']]?.src ??
        ''
    )
    rgb_url.searchParams.delete('channel')
    rgb_url.searchParams.set('channel', 'rgb')
    this.image = new Image()
    this.image.onload = function () {
      maskCanvas.width = self.image!.width
      maskCanvas.height = self.image!.height

      self.invalidateCanvas(self.image!, mask_image)
      self.initializeCanvasPanZoom()
    }
    this.image.src = rgb_url.toString()
  }

  initializeCanvasPanZoom() {
    if (!this.image) {
      throw Error('Missing image')
    }
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
    if (!this.image) {
      throw Error('Missing image')
    }
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
  }

  setEventHandler(maskCanvas: HTMLCanvasElement) {
    const self = this

    if (!this.handler_registered) {
      maskCanvas.addEventListener('contextmenu', (event: Event) => {
        event.preventDefault()
      })

      this.element.addEventListener('wheel', (event: MouseEvent) =>
        this.handleWheelEvent(self, event)
      )
      this.element.addEventListener('pointermove', (event: PointerEvent) =>
        this.pointMoveEvent(self, event)
      )
      this.element.addEventListener('touchmove', (event: TouchEvent) =>
        // @ts-ignore
        this.pointMoveEvent(self, event)
      )

      this.element.addEventListener('dragstart', (event: MouseEvent) => {
        if (event.ctrlKey) {
          event.preventDefault()
        }
      })

      maskCanvas.addEventListener('pointerdown', (event: PointerEvent) =>
        this.handlePointerDown(self, event)
      )
      maskCanvas.addEventListener('pointermove', (event: PointerEvent) =>
        this.draw_move(self, event)
      )
      maskCanvas.addEventListener('touchmove', (event: TouchEvent) =>
        // @ts-ignore
        this.draw_move(self, event)
      )
      maskCanvas.addEventListener('pointerover', (event: PointerEvent) => {
        this.brush!.style.display = 'block'
      })
      maskCanvas.addEventListener('pointerleave', (event: PointerEvent) => {
        this.brush!.style.display = 'none'
      })

      document.addEventListener('pointerup', MaskEditorDialog.handlePointerUp)

      this.handler_registered = true
    }
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
        opacity: this.brush_opacity
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

  getColorButtonText() {
    let colorCaption = 'unknown'

    if (this.brush_color_mode === 'black') {
      colorCaption = 'black'
    } else if (this.brush_color_mode === 'white') {
      colorCaption = 'white'
    } else if (this.brush_color_mode === 'negative') {
      colorCaption = 'negative'
    }

    return 'Color: ' + colorCaption
  }

  updateWhenBrushColorModeChanged() {
    this.colorButton!.innerText = this.getColorButtonText()

    // update mask canvas css styles

    const maskCanvasStyle = this.getMaskCanvasStyle()
    this.maskCanvas.style.mixBlendMode = maskCanvasStyle.mixBlendMode
    this.maskCanvas.style.opacity = maskCanvasStyle.opacity.toString()

    // update mask canvas rgb colors

    const maskColor = this.getMaskColor()

    const maskData = this.maskCtx!.getImageData(
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

    this.maskCtx!.putImageData(maskData, 0, 0)
  }

  brush_opacity = 0.7
  brush_size = 10
  brush_color_mode = 'black'
  drawing_mode = false
  lastx = -1
  lasty = -1
  lasttime = 0

  static handleKeyDown(event: KeyboardEvent) {
    const self = MaskEditorDialog.instance as MaskEditorDialog
    if (event.key === ']') {
      self.brush_size = Math.min(self.brush_size + 2, 100)
      self.brush_slider_input.value = self.brush_size.toString()
    } else if (event.key === '[') {
      self.brush_size = Math.max(self.brush_size - 2, 1)
      self.brush_slider_input.value = self.brush_size.toString()
    } else if (event.key === 'Enter') {
      self.save()
    }

    self.updateBrushPreview(self)
  }

  static handlePointerUp(event: PointerEvent) {
    event.preventDefault()

    this.mousedown_x = null
    this.mousedown_y = null

    MaskEditorDialog.instance!.drawing_mode = false
  }

  updateBrushPreview(self: MaskEditorDialog) {
    const brush = self.brush

    var centerX = self.cursorX ?? 0
    var centerY = self.cursorY ?? 0

    brush!.style.width = self.brush_size * 2 * this.zoom_ratio + 'px'
    brush!.style.height = self.brush_size * 2 * this.zoom_ratio + 'px'
    brush!.style.left = centerX - self.brush_size * this.zoom_ratio + 'px'
    brush!.style.top = centerY - self.brush_size * this.zoom_ratio + 'px'
  }

  handleWheelEvent(self: MaskEditorDialog, event: MouseEvent) {
    event.preventDefault()

    if (event.ctrlKey) {
      // zoom canvas
      // @ts-ignore
      if (event.deltaY < 0) {
        this.zoom_ratio = Math.min(10.0, this.zoom_ratio + 0.2)
      } else {
        this.zoom_ratio = Math.max(0.2, this.zoom_ratio - 0.2)
      }

      this.invalidatePanZoom()
    } else {
      // adjust brush size
      // @ts-ignore
      if (event.deltaY < 0) this.brush_size = Math.min(this.brush_size + 2, 100)
      else this.brush_size = Math.max(this.brush_size - 2, 1)

      this.brush_slider_input.value = this.brush_size.toString()

      this.updateBrushPreview(this)
    }
  }

  pointMoveEvent(self: MaskEditorDialog, event: PointerEvent) {
    this.cursorX = event.pageX
    this.cursorY = event.pageY

    self.updateBrushPreview(self)

    if (event.ctrlKey) {
      event.preventDefault()
      self.pan_move(self, event)
    }

    let left_button_down =
      (window.TouchEvent && event instanceof TouchEvent) || event.buttons == 1

    if (event.shiftKey && left_button_down) {
      self.drawing_mode = false

      const y = event.clientY
      let delta = (self.zoom_lasty! - y) * 0.005
      self.zoom_ratio = Math.max(
        Math.min(10.0, self.last_zoom_ratio - delta),
        0.2
      )

      this.invalidatePanZoom()
      return
    }
  }

  pan_move(self: MaskEditorDialog, event: MouseEvent) {
    if (event.buttons == 1) {
      if (
        typeof MaskEditorDialog.mousedown_x === 'number' &&
        typeof MaskEditorDialog.mousedown_y === 'number'
      ) {
        let deltaX = MaskEditorDialog.mousedown_x - event.clientX
        let deltaY = MaskEditorDialog.mousedown_y - event.clientY

        self.pan_x = (this.mousedown_pan_x ?? 0) - deltaX
        self.pan_y = (this.mousedown_pan_y ?? 0) - deltaY

        self.invalidatePanZoom()
      }
    }
  }

  draw_move(self: MaskEditorDialog, event: MouseEvent) {
    if (event.ctrlKey || event.shiftKey) {
      return
    }

    event.preventDefault()

    this.cursorX = event.pageX
    this.cursorY = event.pageY

    self.updateBrushPreview(self)

    let left_button_down =
      (window.TouchEvent && event instanceof TouchEvent) || event.buttons == 1
    let right_button_down = [2, 5, 32].includes(event.buttons)
    let diff = 0
    if (!event.altKey && left_button_down) {
      diff = performance.now() - self.lasttime

      const maskRect = self.maskCanvas.getBoundingClientRect()

      var x = event.offsetX
      var y = event.offsetY

      if (event.offsetX == null) {
        // @ts-ignore
        x = event.targetTouches[0].clientX - maskRect.left
      }

      if (event.offsetY == null) {
        // @ts-ignore
        y = event.targetTouches[0].clientY - maskRect.top
      }

      x /= self.zoom_ratio
      y /= self.zoom_ratio

      var brush_size = this.brush_size
      if (event instanceof PointerEvent && event.pointerType == 'pen') {
        brush_size *= event.pressure
        this.last_pressure = event.pressure
      } else if (
        window.TouchEvent &&
        event instanceof TouchEvent &&
        diff < 20
      ) {
        // The firing interval of PointerEvents in Pen is unreliable, so it is supplemented by TouchEvents.
        brush_size *= this.last_pressure
      } else {
        brush_size = this.brush_size
      }

      if (diff > 20 && !this.drawing_mode)
        requestAnimationFrame(() => {
          self.init_shape(self, CompositionOperation.SourceOver)
          self.draw_shape(self, x, y, brush_size)
          self.lastx = x
          self.lasty = y
        })
      else
        requestAnimationFrame(() => {
          self.init_shape(self, CompositionOperation.SourceOver)

          var dx = x - self.lastx
          var dy = y - self.lasty

          var distance = Math.sqrt(dx * dx + dy * dy)
          var directionX = dx / distance
          var directionY = dy / distance

          for (var i = 0; i < distance; i += 5) {
            var px = self.lastx + directionX * i
            var py = self.lasty + directionY * i
            self.draw_shape(self, px, py, brush_size)
          }
          self.lastx = x
          self.lasty = y
        })

      self.lasttime = performance.now()
    } else if ((event.altKey && left_button_down) || right_button_down) {
      const maskRect = self.maskCanvas.getBoundingClientRect()
      const x =
        // @ts-ignore
        (event.offsetX || event.targetTouches[0].clientX - maskRect.left) /
        self.zoom_ratio
      const y =
        // @ts-ignore
        (event.offsetY || event.targetTouches[0].clientY - maskRect.top) /
        self.zoom_ratio

      let brush_size = this.brush_size
      if (event instanceof PointerEvent && event.pointerType == 'pen') {
        brush_size *= event.pressure
        this.last_pressure = event.pressure
      } else if (
        window.TouchEvent &&
        event instanceof TouchEvent &&
        diff < 20
      ) {
        brush_size *= this.last_pressure
      } else {
        brush_size = this.brush_size
      }

      if (diff > 20 && !this.drawing_mode)
        // cannot tracking drawing_mode for touch event
        requestAnimationFrame(() => {
          self.init_shape(self, CompositionOperation.DestinationOut)
          self.draw_shape(self, x, y, brush_size)
          self.lastx = x
          self.lasty = y
        })
      else
        requestAnimationFrame(() => {
          self.init_shape(self, CompositionOperation.DestinationOut)

          var dx = x - self.lastx
          var dy = y - self.lasty

          var distance = Math.sqrt(dx * dx + dy * dy)
          var directionX = dx / distance
          var directionY = dy / distance

          for (var i = 0; i < distance; i += 5) {
            var px = self.lastx + directionX * i
            var py = self.lasty + directionY * i
            self.draw_shape(self, px, py, brush_size)
          }
          self.lastx = x
          self.lasty = y
        })

      self.lasttime = performance.now()
    }
  }

  handlePointerDown(self: MaskEditorDialog, event: PointerEvent) {
    if (event.ctrlKey) {
      if (event.buttons == 1) {
        MaskEditorDialog.mousedown_x = event.clientX
        MaskEditorDialog.mousedown_y = event.clientY

        this.mousedown_pan_x = this.pan_x
        this.mousedown_pan_y = this.pan_y
      }
      return
    }

    var brush_size = this.brush_size
    if (event instanceof PointerEvent && event.pointerType == 'pen') {
      brush_size *= event.pressure
      this.last_pressure = event.pressure
    }

    if ([0, 2, 5].includes(event.button)) {
      self.drawing_mode = true

      event.preventDefault()

      if (event.shiftKey) {
        self.zoom_lasty = event.clientY
        self.last_zoom_ratio = self.zoom_ratio
        return
      }

      const maskRect = self.maskCanvas.getBoundingClientRect()
      const x =
        // @ts-ignore
        (event.offsetX || event.targetTouches[0].clientX - maskRect.left) /
        self.zoom_ratio
      const y =
        // @ts-ignore
        (event.offsetY || event.targetTouches[0].clientY - maskRect.top) /
        self.zoom_ratio

      if (!event.altKey && event.button == 0) {
        self.init_shape(self, CompositionOperation.SourceOver)
      } else {
        self.init_shape(self, CompositionOperation.DestinationOut)
      }
      self.draw_shape(self, x, y, brush_size)
      self.lastx = x
      self.lasty = y
      self.lasttime = performance.now()
    }
  }

  init_shape(
    self: MaskEditorDialog,
    compositionOperation: CompositionOperation
  ) {
    self.maskCtx!.beginPath()
    if (compositionOperation == CompositionOperation.SourceOver) {
      self.maskCtx!.fillStyle = this.getMaskFillStyle()
      self.maskCtx!.globalCompositeOperation = CompositionOperation.SourceOver
    } else if (compositionOperation == CompositionOperation.DestinationOut) {
      self.maskCtx!.globalCompositeOperation =
        CompositionOperation.DestinationOut
    }
  }

  draw_shape(self: MaskEditorDialog, x: number, y: number, brush_size: number) {
    if (self.pointer_type === PointerType.Rect) {
      self.maskCtx!.rect(
        x - brush_size,
        y - brush_size,
        brush_size * 2,
        brush_size * 2
      )
    } else {
      self.maskCtx!.arc(x, y, brush_size, 0, Math.PI * 2, false)
    }
    self.maskCtx!.fill()
  }

  async save() {
    const backupCanvas = document.createElement('canvas')
    const backupCtx = backupCanvas.getContext('2d', {
      willReadFrequently: true
    })
    if (!backupCtx) {
      throw Error('failed to get context')
    }
    if (!this.image) {
      throw Error('Missing image')
    }
    backupCanvas.width = this.image.width
    backupCanvas.height = this.image.height

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
      if (backupData.data[i + 3] == 255) backupData.data[i + 3] = 0
      else backupData.data[i + 3] = 255

      backupData.data[i] = 0
      backupData.data[i + 1] = 0
      backupData.data[i + 2] = 0
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

    if (ComfyApp.clipspace?.images) ComfyApp.clipspace.images[0] = item

    if (ComfyApp.clipspace?.widgets) {
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
      filename: original_url.searchParams.get('filename') as string
    }

    let original_subfolder = original_url.searchParams.get('subfolder')
    if (original_subfolder) original_ref.subfolder = original_subfolder

    let original_type = original_url.searchParams.get('type')
    if (original_type) original_ref.type = original_type

    formData.append('image', blob, filename)
    formData.append('original_ref', JSON.stringify(original_ref))
    formData.append('type', 'input')
    formData.append('subfolder', 'clipspace')

    this.saveButton!.innerText = 'Saving...'
    this.saveButton!.disabled = true
    await uploadMask(item, formData)
    ComfyApp.onClipspaceEditorSave()
    this.close()
  }
}

app.registerExtension({
  name: 'Comfy.MaskEditor',
  init(app: ComfyApp) {
    // @ts-ignore
    ComfyApp.open_maskeditor = function () {
      const dlg = MaskEditorDialog.getInstance()
      if (!dlg.isOpened()) {
        dlg.show()
      }
    }

    const context_predicate = () => (ComfyApp.clipspace?.imgs?.length ?? 0) > 0
    ClipspaceDialog.registerButton(
      'MaskEditor',
      context_predicate,
      // @ts-ignore
      ComfyApp.open_maskeditor
    )
  }
})
