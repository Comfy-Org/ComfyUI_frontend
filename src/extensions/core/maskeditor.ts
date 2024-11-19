import { app } from '../../scripts/app'
import { ComfyDialog, $el } from '../../scripts/ui'
import { ComfyApp } from '../../scripts/app'
import { api } from '../../scripts/api'
import { ClipspaceDialog } from './clipspace'
import { MaskEditorDialogOld } from './maskEditorOld'

var styles = `
  #maskEditorContainer {
    display: fixed;
  }
  #maskEditor_brush {
    position: absolute;
    backgroundColor: transparent;
    z-index: 8889;
    pointer-events: none;
    border-radius: 50%;
    overflow: visible;
    outline: 1px dashed black;
    box-shadow: 0 0 0 1px white;
  }
  #maskEditor_brushPreviewGradient {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: none;
  }
  #maskEditor {
    display: block;
    width: 100%;
    height: 100vh;
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
    overflow-y: scroll;
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
    background-color: rgba(0, 0, 0, 0.2);
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
    background: rgba(0, 0, 0, 0.2);
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
    fill: var(--input-text);
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
    background-color: rgba(0, 0, 0, 0.2);
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
    background: rgba(0, 0, 0, 0.2);
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
    background: rgba(0, 0, 0, 0.2);
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
    background: white;
    width: 100%;
    height: 100%;
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
    flex-direction: column;
  }
  #maskEditorCanvasContainer {
    position: absolute;
    width: 1000px;
    height: 667px;
    left: 359px;
    top: 280px;
  }
  #imageCanvas {
    width: 100%;
    height: 100%;
  }
  #maskCanvas {
    width: 100%;
    height: 100%;
  }
  #maskEditor_uiHorizontalContainer {
    width: 100%;
    height: 100%;
    display: flex;
  }
  #maskEditor_topBar {
    display: flex;
    height: 44px;
    align-items: center;
    background: var(--comfy-menu-bg);
  }
  #maskEditor_topBarTitle {
    margin: 0;
    margin-left: 0.5rem;
    margin-right: 0.5rem;
    font-size: 1.2em;
  }
  #maskEditor_topBarButtonContainer {
    display: flex;
    gap: 10px;
    margin-right: 0.5rem;
    position: absolute;
    right: 10px;
    width: 180px;
  }
  #maskEditor_topBarShortcutsContainer {
    display: flex;
  }

  .maskEditor_topPanelIconButton {
    width: 30px;
    height: 30px;
    pointer-events: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: background-color 0.1s;
  }

  .maskEditor_topPanelButton {
    height: 30px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-color);
    color: var(--input-text);
    font-family: sans-serif;
    pointer-events: auto;
    transition: background-color 0.1s;
    width: 53.3px;
  }
  #maskEditor_topPanelButton:hover {
    background-color: var(--p-overlaybadge-outline-color);
  }
  #maskEditor_sidePanelColorSelectSettings {
    flex-direction: column;
  }
  
  .maskEditor_sidePanel_paintBucket_Container {
    width: 180px;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .maskEditor_sidePanel_colorSelect_Container {
    display: flex;
    width: 180px;
    align-items: center;
    gap: 5px;
    height: 30px;
  }
  
  #maskEditor_sidePanelVisibilityToggle {
    position: absolute;
    right: 0;
  }

  #maskEditor_sidePanelColorSelectMethodSelect {
    position: absolute;
    right: 0;
    height: 30px;
    border-radius: 0;
    border: 1px solid var(--border-color);
    background: rgba(0,0,0,0.2);
  }

  #maskEditor_sidePanelVisibilityToggle {
    position: absolute;
    right: 0;
  }

  .maskEditor_sidePanel_colorSelect_tolerance_container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
  }
`

var styleSheet = document.createElement('style')
styleSheet.type = 'text/css'
styleSheet.innerText = styles
document.head.appendChild(styleSheet)

enum BrushShape {
  Arc = 'arc',
  Rect = 'rect'
}

enum Tools {
  Pen = 'pen',
  Eraser = 'eraser',
  PaintBucket = 'paintBucket',
  ColorSelect = 'colorSelect'
}

enum CompositionOperation {
  SourceOver = 'source-over',
  DestinationOut = 'destination-out'
}

enum MaskBlendMode {
  Black = 'black',
  White = 'white',
  Negative = 'negative'
}

enum ColorComparisonMethod {
  Simple = 'simple',
  HSL = 'hsl',
  LAB = 'lab'
}

interface Point {
  x: number
  y: number
}

interface Offset {
  x: number
  y: number
}

export interface Brush {
  size: number
  opacity: number
  hardness: number
  type: BrushShape
}

type Callback = (data?: any) => void

class MaskEditorDialog extends ComfyDialog {
  static instance: MaskEditorDialog | null = null

  //new
  private uiManager!: UIManager
  private toolManager!: ToolManager
  private panAndZoomManager!: PanAndZoomManager
  private brushTool!: BrushTool
  private paintBucketTool!: PaintBucketTool
  private colorSelectTool!: ColorSelectTool
  private canvasHistory!: CanvasHistory
  private messageBroker!: MessageBroker
  private keyboardManager!: KeyboardManager

  private rootElement!: HTMLElement
  private imageURL!: string

  private isLayoutCreated: boolean = false
  private isOpen: boolean = false

  //variables needed?
  last_display_style: string | null = null

  constructor() {
    super()
    this.rootElement = $el(
      'div.maskEditor_hidden',
      { parent: document.body },
      []
    )

    this.element = this.rootElement
  }

  static getInstance() {
    if (!ComfyApp.clipspace || !ComfyApp.clipspace.imgs) {
      throw new Error('No clipspace images found')
    }
    const currentSrc =
      ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']].src

    if (
      !MaskEditorDialog.instance ||
      currentSrc !== MaskEditorDialog.instance.imageURL
    ) {
      MaskEditorDialog.instance = new MaskEditorDialog()
    }
    return MaskEditorDialog.instance
  }

  async show() {
    this.cleanup()
    if (!this.isLayoutCreated) {
      // layout
      this.messageBroker = new MessageBroker()
      this.canvasHistory = new CanvasHistory(this, 20)
      this.paintBucketTool = new PaintBucketTool(this)
      this.brushTool = new BrushTool(this)
      this.panAndZoomManager = new PanAndZoomManager(this)
      this.toolManager = new ToolManager(this)
      this.keyboardManager = new KeyboardManager(this)
      this.uiManager = new UIManager(this.rootElement, this)
      this.colorSelectTool = new ColorSelectTool(this)

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
      observer.observe(this.rootElement, config)

      this.isLayoutCreated = true

      await this.uiManager.setlayout()
    }

    //this.zoomAndPanManager.reset()

    this.rootElement.id = 'maskEditor'
    this.rootElement.style.display = 'flex'
    this.element.style.display = 'flex'
    await this.uiManager.initUI()
    this.paintBucketTool.initPaintBucketTool()
    this.colorSelectTool.initColorSelectTool()
    await this.canvasHistory.saveInitialState()
    this.isOpen = true
    if (ComfyApp.clipspace && ComfyApp.clipspace.imgs) {
      const src =
        ComfyApp.clipspace?.imgs[ComfyApp.clipspace['selectedIndex']].src
      this.uiManager.setSidebarImage(src)
    }
    this.keyboardManager.addListeners()
  }

  private cleanup() {
    // Remove all maskEditor elements
    const maskEditors = document.querySelectorAll('[id^="maskEditor"]')
    maskEditors.forEach((element) => element.remove())

    // Remove brush elements specifically
    const brushElements = document.querySelectorAll('#maskEditor_brush')
    brushElements.forEach((element) => element.remove())
  }

  isOpened() {
    return this.isOpen
  }

  async save() {
    const backupCanvas = document.createElement('canvas')
    const imageCanvas = this.uiManager.getImgCanvas()
    const maskCanvas = this.uiManager.getMaskCanvas()
    const image = this.uiManager.getImage()
    const backupCtx = backupCanvas.getContext('2d', {
      willReadFrequently: true
    })

    backupCanvas.width = imageCanvas.width
    backupCanvas.height = imageCanvas.height

    if (!backupCtx) {
      return
    }

    // Ensure the mask image is fully loaded
    const maskImageLoaded = new Promise<void>((resolve, reject) => {
      const maskImage = new Image()
      maskImage.src = maskCanvas.toDataURL()
      maskImage.onload = () => {
        resolve()
      }
      maskImage.onerror = (error) => {
        reject(error)
      }
    })

    try {
      await maskImageLoaded
    } catch (error) {
      console.error('Error loading mask image:', error)
      return
    }

    backupCtx.clearRect(0, 0, backupCanvas.width, backupCanvas.height)
    backupCtx.drawImage(
      maskCanvas,
      0,
      0,
      maskCanvas.width,
      maskCanvas.height,
      0,
      0,
      backupCanvas.width,
      backupCanvas.height
    )

    let maskHasContent = false
    const maskData = backupCtx.getImageData(
      0,
      0,
      backupCanvas.width,
      backupCanvas.height
    )

    for (let i = 0; i < maskData.data.length; i += 4) {
      if (maskData.data[i + 3] !== 0) {
        maskHasContent = true
        break
      }
    }

    // paste mask data into alpha channel
    const backupData = backupCtx.getImageData(
      0,
      0,
      backupCanvas.width,
      backupCanvas.height
    )

    let backupHasContent = false
    for (let i = 0; i < backupData.data.length; i += 4) {
      if (backupData.data[i + 3] !== 0) {
        backupHasContent = true
        break
      }
    }

    if (maskHasContent && !backupHasContent) {
      console.error('Mask appears to be empty')
      alert('Cannot save empty mask')
      return
    }

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

    if (ComfyApp?.clipspace?.widgets?.length) {
      const index = ComfyApp.clipspace.widgets.findIndex(
        (obj) => obj?.name === 'image'
      )

      if (index >= 0 && item !== undefined) {
        try {
          ComfyApp.clipspace.widgets[index].value = item
        } catch (err) {
          console.warn('Failed to set widget value:', err)
        }
      }
    }

    const dataURL = backupCanvas.toDataURL()
    const blob = this.dataURLToBlob(dataURL)

    let original_url = new URL(image.src)

    type Ref = { filename: string; subfolder?: string; type?: string }

    this.uiManager.setBrushOpacity(0)

    const filenameRef = original_url.searchParams.get('filename')
    if (!filenameRef) {
      throw new Error('filename parameter is required')
    }
    const original_ref: Ref = {
      filename: filenameRef
    }

    let original_subfolder = original_url.searchParams.get('subfolder')
    if (original_subfolder) original_ref.subfolder = original_subfolder

    let original_type = original_url.searchParams.get('type')
    if (original_type) original_ref.type = original_type

    formData.append('image', blob, filename)
    formData.append('original_ref', JSON.stringify(original_ref))
    formData.append('type', 'input')
    formData.append('subfolder', 'clipspace')

    this.uiManager.setSaveButtonText('Saving...')
    this.uiManager.setSaveButtonEnabled(false)
    this.keyboardManager.removeListeners()

    // Retry mechanism
    const maxRetries = 3
    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success) {
      try {
        await this.uploadMask(item, formData)
        success = true
      } catch (error) {
        console.error(`Upload attempt ${attempt + 1} failed:`, error)
        attempt++
        if (attempt < maxRetries) {
          console.log('Retrying upload...')
        } else {
          console.log('Max retries reached. Upload failed.')
        }
      }
    }

    if (success) {
      ComfyApp.onClipspaceEditorSave()
      this.close()
      this.isOpen = false
    } else {
      this.uiManager.setSaveButtonText('Save')
      this.uiManager.setSaveButtonEnabled(true)
      this.keyboardManager.addListeners()
    }
  }

  getMessageBroker() {
    return this.messageBroker
  }

  // Helper function to convert a data URL to a Blob object
  private dataURLToBlob(dataURL: string) {
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

  private async uploadMask(
    filepath: { filename: string; subfolder: string; type: string },
    formData: FormData,
    retries = 3
  ) {
    if (retries <= 0) {
      throw new Error('Max retries reached')
      return
    }
    await api
      .fetchApi('/upload/mask', {
        method: 'POST',
        body: formData
      })
      .then((response) => {
        if (!response.ok) {
          console.log('Failed to upload mask:', response)
          this.uploadMask(filepath, formData, 2)
        }
      })
      .catch((error) => {
        console.error('Error:', error)
      })

    try {
      const selectedIndex = ComfyApp.clipspace?.selectedIndex
      if (ComfyApp.clipspace?.imgs && selectedIndex !== undefined) {
        // Create and set new image
        const newImage = new Image()
        newImage.src = api.apiURL(
          '/view?' +
            new URLSearchParams(filepath).toString() +
            app.getPreviewFormatParam() +
            app.getRandParam()
        )
        ComfyApp.clipspace.imgs[selectedIndex] = newImage

        // Update images array if it exists
        if (ComfyApp.clipspace.images) {
          ComfyApp.clipspace.images[selectedIndex] = filepath
        }
      }
    } catch (err) {
      console.warn('Failed to update clipspace image:', err)
    }
    ClipspaceDialog.invalidatePreview()
  }
}

class CanvasHistory {
  private maskEditor!: MaskEditorDialog
  private messageBroker!: MessageBroker

  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private states: ImageData[] = []
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

  restoreState(state: ImageData) {
    if (state && this.initialized) {
      this.ctx.putImageData(state, 0, 0)
    }
  }
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
  }

  private addPullTopics() {
    this.messageBroker.createPullTopic(
      'getTolerance',
      async () => this.tolerance
    )
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

    const maskColor = await this.messageBroker.pull('getMaskColor')
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
      // Set alpha to 255 for fill mode, 0 for erase mode
      this.setPixel(x, y, isFillMode ? 255 : 0, maskColor)

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
}

class ColorSelectTool {
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
      const maskColor = await this.messageBroker.pull('getMaskColor')

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
            this.setPixel(x, y, 255, maskColor)
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
      const maskColor = await this.messageBroker.pull('getMaskColor')

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
        this.setPixel(x, y, 255, maskColor)

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
}

class BrushTool {
  brushSettings: Brush //this saves the current brush settings
  maskBlendMode: MaskBlendMode

  isDrawing: boolean = false
  isDrawingLine: boolean = false
  lineStartPoint: Point | null = null
  smoothingCordsArray: Point[] = []
  smoothingLastDrawTime!: Date
  maskCtx: CanvasRenderingContext2D | null = null

  //brush adjustment
  isBrushAdjusting: boolean = false
  brushPreviewGradient: HTMLElement | null = null
  initialPoint: Point | null = null

  maskEditor: MaskEditorDialog
  messageBroker: MessageBroker

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.createListeners()
    this.addPullTopics()

    this.brushSettings = {
      size: 10,
      opacity: 100,
      hardness: 1,
      type: BrushShape.Arc
    }
    this.maskBlendMode = MaskBlendMode.Black
  }

  private createListeners() {
    //setters
    this.messageBroker.subscribe('setBrushSize', (size: number) =>
      this.setBrushSize(size)
    )
    this.messageBroker.subscribe('setBrushOpacity', (opacity: number) =>
      this.setBrushOpacity(opacity)
    )
    this.messageBroker.subscribe('setBrushHardness', (hardness: number) =>
      this.setBrushHardness(hardness)
    )
    this.messageBroker.subscribe('setBrushShape', (type: BrushShape) =>
      this.setBrushType(type)
    )
    //brush adjustment
    this.messageBroker.subscribe(
      'brushAdjustmentStart',
      (event: PointerEvent) => this.startBrushAdjustment(event)
    )
    this.messageBroker.subscribe('brushAdjustment', (event: PointerEvent) =>
      this.handleBrushAdjustment(event)
    )
    //drawing
    this.messageBroker.subscribe('drawStart', (event: PointerEvent) =>
      this.start_drawing(event)
    )
    this.messageBroker.subscribe('draw', (event: PointerEvent) =>
      this.handleDrawing(event)
    )
    this.messageBroker.subscribe('drawEnd', (event: PointerEvent) =>
      this.drawEnd(event)
    )
  }

  private addPullTopics() {
    this.messageBroker.createPullTopic(
      'brushSize',
      async () => this.brushSettings.size
    )
    this.messageBroker.createPullTopic(
      'brushOpacity',
      async () => this.brushSettings.opacity
    )
    this.messageBroker.createPullTopic(
      'brushHardness',
      async () => this.brushSettings.hardness
    )
    this.messageBroker.createPullTopic(
      'brushType',
      async () => this.brushSettings.type
    )
    this.messageBroker.createPullTopic(
      'maskBlendMode',
      async () => this.maskBlendMode
    )
    this.messageBroker.createPullTopic(
      'brushSettings',
      async () => this.brushSettings
    )
  }

  private async start_drawing(event: PointerEvent) {
    this.isDrawing = true
    let compositionOp: CompositionOperation
    let currentTool = await this.messageBroker.pull('currentTool')
    let coords = { x: event.offsetX, y: event.offsetY }
    let coords_canvas = await this.messageBroker.pull('screenToCanvas', coords)

    //set drawing mode
    if (currentTool === Tools.Eraser || event.buttons == 2) {
      compositionOp = CompositionOperation.DestinationOut //eraser
    } else {
      compositionOp = CompositionOperation.SourceOver //pen
    }

    //check if user wants to draw line or free draw
    if (event.shiftKey && this.lineStartPoint) {
      this.isDrawingLine = true
      this.drawLine(this.lineStartPoint, coords_canvas, compositionOp)
    } else {
      this.isDrawingLine = false
      this.init_shape(compositionOp)
      this.draw_shape(coords_canvas)
    }
    this.lineStartPoint = coords_canvas
    this.smoothingCordsArray = [coords_canvas] //used to smooth the drawing line
    this.smoothingLastDrawTime = new Date()
  }

  private async handleDrawing(event: PointerEvent) {
    var diff = performance.now() - this.smoothingLastDrawTime.getTime()
    let coords = { x: event.offsetX, y: event.offsetY }
    let coords_canvas = await this.messageBroker.pull('screenToCanvas', coords)
    let currentTool = await this.messageBroker.pull('currentTool')

    /* move to draw
    if (event instanceof PointerEvent && event.pointerType == 'pen') {
      brush_size *= event.pressure
      this.last_pressure = event.pressure
    } else {
      brush_size = this.brush_size //this is the problem with pen pressure
    }
    */

    if (diff > 20 && !this.isDrawing)
      requestAnimationFrame(() => {
        this.init_shape(CompositionOperation.SourceOver)
        this.draw_shape(coords_canvas)
        this.smoothingCordsArray.push(coords_canvas)
      })
    else
      requestAnimationFrame(() => {
        if (currentTool === Tools.Eraser || event.buttons == 2) {
          this.init_shape(CompositionOperation.DestinationOut)
        } else {
          this.init_shape(CompositionOperation.SourceOver)
        }

        //use drawWithSmoothing for better performance or change step in drawWithBetterSmoothing
        this.drawWithBetterSmoothing(coords_canvas)
      })

    this.smoothingLastDrawTime = new Date()
  }

  private async drawEnd(event: PointerEvent) {
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = await this.messageBroker.pull(
      'screenToCanvas',
      coords
    )

    if (this.isDrawing) {
      this.isDrawing = false
      this.messageBroker.publish('saveState')
      this.lineStartPoint = coords_canvas
    }
  }

  private drawWithBetterSmoothing(point: Point) {
    // Add current point to the smoothing array
    if (!this.smoothingCordsArray) {
      this.smoothingCordsArray = []
    }

    this.smoothingCordsArray.push(point)

    // Keep a moving window of points for the spline
    const MAX_POINTS = 5
    if (this.smoothingCordsArray.length > MAX_POINTS) {
      this.smoothingCordsArray.shift()
    }

    // Need at least 3 points for cubic spline interpolation
    if (this.smoothingCordsArray.length >= 3) {
      const dx = point.x - this.smoothingCordsArray[0].x
      const dy = point.y - this.smoothingCordsArray[0].y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const step = 5
      const steps = Math.ceil(distance / step)
      // Generate interpolated points
      const interpolatedPoints = this.calculateCubicSplinePoints(
        this.smoothingCordsArray,
        steps // number of segments between each pair of control points
      )

      // Draw all interpolated points
      for (const point of interpolatedPoints) {
        this.draw_shape(point)
      }

      //reset the smoothing array
      this.smoothingCordsArray = [point]
    } else {
      // If we don't have enough points yet, just draw the current point
      this.draw_shape(point)
    }
  }

  private async drawLine(
    p1: Point,
    p2: Point,
    compositionOp: CompositionOperation
  ) {
    const brush_size = await this.messageBroker.pull('brushSize')
    const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    const steps = Math.ceil(distance / (brush_size / 4)) // Adjust for smoother lines

    this.init_shape(compositionOp)

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = p1.x + (p2.x - p1.x) * t
      const y = p1.y + (p2.y - p1.y) * t
      const point = { x: x, y: y }
      this.draw_shape(point)
    }
  }

  //brush adjustment

  private async startBrushAdjustment(event: PointerEvent) {
    event.preventDefault()
    const coords = { x: event.offsetX, y: event.offsetY }
    let coords_canvas = await this.messageBroker.pull('screenToCanvas', coords)
    this.messageBroker.publish('setBrushPreviewGradientVisibility', true)
    this.initialPoint = coords_canvas
    this.isBrushAdjusting = true
    return
  }

  private async handleBrushAdjustment(event: PointerEvent) {
    const coords = { x: event.offsetX, y: event.offsetY }
    let coords_canvas = await this.messageBroker.pull('screenToCanvas', coords)

    const delta_x = coords_canvas.x - this.initialPoint!.x
    const delta_y = coords_canvas.y - this.initialPoint!.y

    // Adjust brush size (horizontal movement)
    const newSize = Math.max(
      1,
      Math.min(100, this.brushSettings.size! + delta_x / 10)
    )

    // Adjust brush hardness (vertical movement)
    const newHardness = Math.max(
      0,
      Math.min(1, this.brushSettings!.hardness - delta_y / 200)
    )

    this.brushSettings.size = newSize
    this.brushSettings.hardness = newHardness

    this.messageBroker.publish('updateBrushPreview')

    return
  }

  //helper functions

  private async draw_shape(point: Point) {
    const brushSettings: Brush = this.brushSettings
    const maskCtx = this.maskCtx || (await this.messageBroker.pull('maskCtx'))
    const brushType = await this.messageBroker.pull('brushType')
    const maskColor = await this.messageBroker.pull('getMaskColor')
    const size = brushSettings.size
    const opacity = brushSettings.opacity
    const hardness = brushSettings.hardness

    const x = point.x
    const y = point.y

    // Extend the gradient radius beyond the brush size
    const extendedSize = size * (2 - hardness)

    let gradient = maskCtx.createRadialGradient(x, y, 0, x, y, extendedSize)

    const isErasing = maskCtx.globalCompositeOperation === 'destination-out'

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
      let outerStop = size / extendedSize

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

    maskCtx.fillStyle = gradient
    maskCtx.beginPath()
    if (brushType === BrushShape.Rect) {
      maskCtx.rect(
        x - extendedSize,
        y - extendedSize,
        extendedSize * 2,
        extendedSize * 2
      )
    } else {
      maskCtx.arc(x, y, extendedSize, 0, Math.PI * 2, false)
    }
    maskCtx.fill()
  }

  private async init_shape(compositionOperation: CompositionOperation) {
    const maskBlendMode = await this.messageBroker.pull('maskBlendMode')
    const maskCtx = this.maskCtx || (await this.messageBroker.pull('maskCtx'))
    maskCtx.beginPath()
    if (compositionOperation == CompositionOperation.SourceOver) {
      maskCtx.fillStyle = maskBlendMode
      maskCtx.globalCompositeOperation = CompositionOperation.SourceOver
    } else if (compositionOperation == CompositionOperation.DestinationOut) {
      maskCtx.globalCompositeOperation = CompositionOperation.DestinationOut
    }
  }

  private calculateCubicSplinePoints(
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

  private calculateSplineCoefficients(values: number[]): number[] {
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

  private setBrushSize(size: number) {
    this.brushSettings.size = size
  }

  private setBrushOpacity(opacity: number) {
    this.brushSettings.opacity = opacity
  }

  private setBrushHardness(hardness: number) {
    this.brushSettings.hardness = hardness
  }

  private setBrushType(type: BrushShape) {
    this.brushSettings.type = type
  }
}

class UIManager {
  private rootElement: HTMLElement
  private brush!: HTMLDivElement
  private brushPreviewGradient!: HTMLDivElement
  private maskCtx!: CanvasRenderingContext2D
  private imageCtx!: CanvasRenderingContext2D
  private maskCanvas!: HTMLCanvasElement
  private imgCanvas!: HTMLCanvasElement
  private brushSettingsHTML!: HTMLDivElement
  private paintBucketSettingsHTML!: HTMLDivElement
  private colorSelectSettingsHTML!: HTMLDivElement
  private maskOpacitySlider!: HTMLInputElement
  private brushHardnessSlider!: HTMLInputElement
  private brushSizeSlider!: HTMLInputElement
  private brushOpacitySlider!: HTMLInputElement
  private sidebarImage!: HTMLImageElement
  private saveButton!: HTMLButtonElement
  private toolPanel!: HTMLDivElement
  private sidePanel!: HTMLDivElement
  private pointerZone!: HTMLDivElement
  private canvasBackground!: HTMLDivElement
  private canvasContainer!: HTMLDivElement
  private image!: HTMLImageElement

  private maskEditor: MaskEditorDialog
  private messageBroker: MessageBroker

  private mask_opacity: number = 0.7
  private maskBlendMode: MaskBlendMode = MaskBlendMode.Black

  constructor(rootElement: HTMLElement, maskEditor: MaskEditorDialog) {
    this.rootElement = rootElement
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.addListeners()
    this.addPullTopics()
  }

  addListeners() {
    this.messageBroker.subscribe('updateBrushPreview', async () =>
      this.updateBrushPreview()
    )

    this.messageBroker.subscribe(
      'paintBucketCursor',
      (isPaintBucket: boolean) => this.handlePaintBucketCursor(isPaintBucket)
    )

    this.messageBroker.subscribe('panCursor', (isPan: boolean) =>
      this.handlePanCursor(isPan)
    )

    this.messageBroker.subscribe('setBrushVisibility', (isVisible: boolean) =>
      this.setBrushVisibility(isVisible)
    )

    this.messageBroker.subscribe(
      'setBrushPreviewGradientVisibility',
      (isVisible: boolean) => this.setBrushPreviewGradientVisibility(isVisible)
    )

    this.messageBroker.subscribe('updateCursor', () => this.updateCursor())
  }

  addPullTopics() {
    this.messageBroker.createPullTopic(
      'maskCanvas',
      async () => this.maskCanvas
    )
    this.messageBroker.createPullTopic('maskCtx', async () => this.maskCtx)
    this.messageBroker.createPullTopic('imageCtx', async () => this.imageCtx)
    this.messageBroker.createPullTopic('imgCanvas', async () => this.imgCanvas)
    this.messageBroker.createPullTopic(
      'screenToCanvas',
      async (coords: Point) => this.screenToCanvas(coords)
    )
    this.messageBroker.createPullTopic(
      'getCanvasContainer',
      async () => this.canvasContainer
    )
    this.messageBroker.createPullTopic('getMaskColor', async () =>
      this.getMaskColor()
    )
  }

  async setlayout() {
    var user_ui = await this.createUI()
    var canvasContainer = this.createBackgroundUI()

    var brush = await this.createBrush()
    await this.setBrushBorderRadius()
    this.setBrushOpacity(1)
    this.rootElement.appendChild(canvasContainer)
    this.rootElement.appendChild(user_ui)
    document.body.appendChild(brush)
  }

  private async createUI() {
    var ui_container = document.createElement('div')
    ui_container.id = 'maskEditor_uiContainer'

    var top_bar = await this.createTopBar()

    var ui_horizontal_container = document.createElement('div')
    ui_horizontal_container.id = 'maskEditor_uiHorizontalContainer'

    var side_panel_container = await this.createSidePanel()

    var pointer_zone = this.createPointerZone()

    var tool_panel = this.createToolPanel()

    ui_horizontal_container.appendChild(tool_panel)
    ui_horizontal_container.appendChild(pointer_zone)
    ui_horizontal_container.appendChild(side_panel_container)

    ui_container.appendChild(top_bar)
    ui_container.appendChild(ui_horizontal_container)

    return ui_container
  }

  private createBackgroundUI() {
    const canvasContainer = document.createElement('div')
    canvasContainer.id = 'maskEditorCanvasContainer'

    const imgCanvas = document.createElement('canvas')
    imgCanvas.id = 'imageCanvas'

    const maskCanvas = document.createElement('canvas')
    maskCanvas.id = 'maskCanvas'

    const canvas_background = document.createElement('div')
    canvas_background.id = 'canvasBackground'

    canvasContainer.appendChild(imgCanvas)
    canvasContainer.appendChild(maskCanvas)
    canvasContainer.appendChild(canvas_background)

    // prepare content
    this.imgCanvas = imgCanvas!
    this.maskCanvas = maskCanvas!
    this.canvasContainer = canvasContainer!
    this.canvasBackground = canvas_background!
    let maskCtx = maskCanvas!.getContext('2d', { willReadFrequently: true })
    if (maskCtx) {
      this.maskCtx = maskCtx
    }
    let imgCtx = imgCanvas!.getContext('2d', { willReadFrequently: true })
    if (imgCtx) {
      this.imageCtx = imgCtx
    }
    this.setEventHandler()

    //remove styling and move to css file

    this.imgCanvas.style.position = 'absolute'
    this.maskCanvas.style.position = 'absolute'

    this.imgCanvas.style.top = '200'
    this.imgCanvas.style.left = '0'

    this.maskCanvas.style.top = this.imgCanvas.style.top
    this.maskCanvas.style.left = this.imgCanvas.style.left

    const maskCanvasStyle = this.getMaskCanvasStyle()
    this.maskCanvas.style.mixBlendMode = maskCanvasStyle.mixBlendMode
    this.maskCanvas.style.opacity = maskCanvasStyle.opacity.toString()

    return canvasContainer
  }

  async setBrushBorderRadius() {
    const brushSettings = await this.messageBroker.pull('brushSettings')

    if (brushSettings.type === BrushShape.Rect) {
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

  async initUI() {
    this.saveButton.innerText = 'Save'
    this.saveButton.disabled = false

    await this.setImages(this.imgCanvas) //probably change method to initImageCanvas
  }

  private async createSidePanel() {
    var side_panel_container = document.createElement('div')
    side_panel_container.id = 'maskEditor_sidePanelContainer'
    this.sidePanel = side_panel_container

    //side panel

    var side_panel = document.createElement('div')
    side_panel.id = 'maskEditor_sidePanel'
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
        this.messageBroker.publish('setBrushShape', BrushShape.Arc)
        this.setBrushBorderRadius()
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
        this.messageBroker.publish('setBrushShape', BrushShape.Rect)
        this.setBrushBorderRadius()
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
        this.messageBroker.publish(
          'setBrushSize',
          parseInt(side_panel_brush_settings_thickness_input.value)
        )
        this.updateBrushPreview()
      }
    )

    this.brushSizeSlider = side_panel_brush_settings_thickness_input

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
        this.messageBroker.publish(
          'setBrushOpacity',
          parseFloat(side_panel_brush_settings_opacity_input.value)
        )
        this.updateBrushPreview()
      }
    )

    this.brushOpacitySlider = side_panel_brush_settings_opacity_input

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
        this.messageBroker.publish(
          'setBrushHardness',
          parseFloat(side_panel_brush_settings_hardness_input.value)
        )
        this.updateBrushPreview()
      }
    )

    this.brushHardnessSlider = side_panel_brush_settings_hardness_input

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

    var side_panel_paint_bucket_settings_container =
      document.createElement('div')
    side_panel_paint_bucket_settings_container.classList.add(
      'maskEditor_sidePanel_paintBucket_Container'
    )

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

    var tolerance = await this.messageBroker.pull('getTolerance')

    side_panel_paint_bucket_settings_tolerance_input.setAttribute('min', '0')
    side_panel_paint_bucket_settings_tolerance_input.setAttribute('max', '255')
    side_panel_paint_bucket_settings_tolerance_input.setAttribute(
      'value',
      String(tolerance)
    )

    side_panel_paint_bucket_settings_tolerance_input.classList.add(
      'maskEditor_sidePanelBrushRange'
    )

    side_panel_paint_bucket_settings_tolerance_input.addEventListener(
      'input',
      (event) => {
        var paintBucketTolerance = parseInt(
          (event.target as HTMLInputElement)!.value
        )

        this.messageBroker.publish(
          'setPaintBucketTolerance',
          paintBucketTolerance
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

    /// color select settings

    var side_panel_color_select_settings = document.createElement('div')
    side_panel_color_select_settings.id =
      'maskEditor_sidePanelColorSelectSettings'
    side_panel_color_select_settings.style.display = 'none'
    this.colorSelectSettingsHTML = side_panel_color_select_settings

    var side_panel_color_select_settings_title = document.createElement('h3')
    side_panel_color_select_settings_title.classList.add(
      'maskEditor_sidePanelTitle'
    )
    side_panel_color_select_settings_title.innerText = 'Color Select Settings'

    var side_panel_color_select_container_tolerance =
      document.createElement('div')
    side_panel_color_select_container_tolerance.classList.add(
      'maskEditor_sidePanel_colorSelect_tolerance_container'
    )

    var side_panel_color_select_settings_tolerance_title =
      document.createElement('span')
    side_panel_color_select_settings_tolerance_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_color_select_settings_tolerance_title.innerText = 'Tolerance'

    var side_panel_color_select_settings_tolerance_input =
      document.createElement('input')
    side_panel_color_select_settings_tolerance_input.setAttribute(
      'type',
      'range'
    )

    var tolerance = await this.messageBroker.pull('getTolerance')

    side_panel_color_select_settings_tolerance_input.setAttribute('min', '0')
    side_panel_color_select_settings_tolerance_input.setAttribute('max', '255')
    side_panel_color_select_settings_tolerance_input.setAttribute(
      'value',
      String(tolerance)
    )

    side_panel_color_select_settings_tolerance_input.classList.add(
      'maskEditor_sidePanelBrushRange'
    )

    side_panel_color_select_settings_tolerance_input.addEventListener(
      'input',
      (event) => {
        var colorSelectTolerance = parseInt(
          (event.target as HTMLInputElement)!.value
        )

        this.messageBroker.publish(
          'setColorSelectTolerance',
          colorSelectTolerance
        )
      }
    )

    side_panel_color_select_container_tolerance.appendChild(
      side_panel_color_select_settings_tolerance_title
    )
    side_panel_color_select_container_tolerance.appendChild(
      side_panel_color_select_settings_tolerance_input
    )

    var side_panel_color_select_container_live_preview =
      document.createElement('div')
    side_panel_color_select_container_live_preview.classList.add(
      'maskEditor_sidePanel_colorSelect_Container'
    )

    var side_panel_color_select_live_preview_title =
      document.createElement('span')
    side_panel_color_select_live_preview_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_color_select_live_preview_title.innerText = 'Live Preview'

    var side_panel_color_select_live_preview_select =
      document.createElement('input')
    side_panel_color_select_live_preview_select.setAttribute('type', 'checkbox')
    side_panel_color_select_live_preview_select.id =
      'maskEditor_sidePanelVisibilityToggle'
    side_panel_color_select_live_preview_select.checked = false

    side_panel_color_select_live_preview_select.addEventListener(
      'change',
      (event) => {
        this.messageBroker.publish(
          'setLivePreview',
          (event.target as HTMLInputElement)!.checked
        )
      }
    )

    side_panel_color_select_container_live_preview.appendChild(
      side_panel_color_select_live_preview_title
    )

    side_panel_color_select_container_live_preview.appendChild(
      side_panel_color_select_live_preview_select
    )

    var side_panel_color_select_container_method = document.createElement('div')
    side_panel_color_select_container_method.classList.add(
      'maskEditor_sidePanel_colorSelect_Container'
    )

    var side_panel_color_select_method_title = document.createElement('span')
    side_panel_color_select_method_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_color_select_method_title.innerText = 'Method'

    var side_panel_color_select_method_select = document.createElement('select')
    side_panel_color_select_method_select.id =
      'maskEditor_sidePanelColorSelectMethodSelect'
    const method_options = Object.values(ColorComparisonMethod)

    method_options.forEach((option) => {
      var option_element = document.createElement('option')
      option_element.value = option
      option_element.innerText = option
      side_panel_color_select_method_select.appendChild(option_element)
    })

    side_panel_color_select_method_select.addEventListener('change', (e) => {
      const selectedValue = (e.target as HTMLSelectElement)
        .value as ColorComparisonMethod
      this.messageBroker.publish('setColorComparisonMethod', selectedValue)
    })

    side_panel_color_select_container_method.appendChild(
      side_panel_color_select_method_title
    )
    side_panel_color_select_container_method.appendChild(
      side_panel_color_select_method_select
    )

    var side_panel_color_select_container_whole_image =
      document.createElement('div')
    side_panel_color_select_container_whole_image.classList.add(
      'maskEditor_sidePanel_colorSelect_Container'
    )

    var side_panel_color_select_whole_image_title =
      document.createElement('span')
    side_panel_color_select_whole_image_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_color_select_whole_image_title.innerText = 'Apply to Whole Image'

    var side_panel_color_select_whole_image_select =
      document.createElement('input')
    side_panel_color_select_whole_image_select.setAttribute('type', 'checkbox')
    side_panel_color_select_whole_image_select.id =
      'maskEditor_sidePanelVisibilityToggle'

    side_panel_color_select_whole_image_select.addEventListener(
      'change',
      (event) => {
        var value = (event.target as HTMLInputElement)!.checked
        this.messageBroker.publish('setWholeImage', value)
        if (value) {
          this.messageBroker.publish('setMaskBoundary', false)
          side_panel_color_select_mask_boundary_select.disabled = true
        } else {
          side_panel_color_select_mask_boundary_select.disabled = false
        }
      }
    )

    var side_panel_color_select_container_mask_boundary =
      document.createElement('div')
    side_panel_color_select_container_mask_boundary.classList.add(
      'maskEditor_sidePanel_colorSelect_Container'
    )

    var side_panel_color_select_mask_boundary_title =
      document.createElement('span')
    side_panel_color_select_mask_boundary_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_color_select_mask_boundary_title.innerText = 'Stop at mask'

    var side_panel_color_select_mask_boundary_select =
      document.createElement('input')
    side_panel_color_select_mask_boundary_select.setAttribute(
      'type',
      'checkbox'
    )
    side_panel_color_select_mask_boundary_select.id =
      'maskEditor_sidePanelVisibilityToggle'

    side_panel_color_select_mask_boundary_select.addEventListener(
      'change',
      (event) => {
        var value = (event.target as HTMLInputElement)!.checked
        this.messageBroker.publish('setMaskBoundary', value)
        if (value) {
          this.messageBroker.publish('setWholeImage', false)
          side_panel_color_select_whole_image_select.disabled = true
        } else {
          side_panel_color_select_whole_image_select.disabled = false
        }
      }
    )

    side_panel_color_select_container_mask_boundary.appendChild(
      side_panel_color_select_mask_boundary_title
    )
    side_panel_color_select_container_mask_boundary.appendChild(
      side_panel_color_select_mask_boundary_select
    )

    var side_panel_color_select_container_mask_tolerance =
      document.createElement('div')
    side_panel_color_select_container_mask_tolerance.classList.add(
      'maskEditor_sidePanel_colorSelect_tolerance_container'
    )

    var side_panel_color_select_mask_tolerance_title =
      document.createElement('span')
    side_panel_color_select_mask_tolerance_title.classList.add(
      'maskEditor_sidePanelSubTitle'
    )
    side_panel_color_select_mask_tolerance_title.innerText = 'Mask Tolerance'

    var side_panel_color_select_mask_tolerance_input =
      document.createElement('input')
    side_panel_color_select_mask_tolerance_input.setAttribute('type', 'range')
    side_panel_color_select_mask_tolerance_input.setAttribute('min', '0')
    side_panel_color_select_mask_tolerance_input.setAttribute('max', '255')
    side_panel_color_select_mask_tolerance_input.setAttribute('value', '0')
    side_panel_color_select_mask_tolerance_input.classList.add(
      'maskEditor_sidePanelBrushRange'
    )

    side_panel_color_select_mask_tolerance_input.addEventListener(
      'input',
      (event) => {
        var maskTolerance = parseInt((event.target as HTMLInputElement)!.value)

        this.messageBroker.publish('setMaskTolerance', maskTolerance)
      }
    )

    side_panel_color_select_container_mask_tolerance.appendChild(
      side_panel_color_select_mask_tolerance_title
    )
    side_panel_color_select_container_mask_tolerance.appendChild(
      side_panel_color_select_mask_tolerance_input
    )

    side_panel_color_select_container_whole_image.appendChild(
      side_panel_color_select_whole_image_title
    )
    side_panel_color_select_container_whole_image.appendChild(
      side_panel_color_select_whole_image_select
    )

    side_panel_paint_bucket_settings_container.appendChild(
      side_panel_color_select_container_tolerance
    )
    side_panel_paint_bucket_settings_container.appendChild(
      side_panel_color_select_container_live_preview
    )
    side_panel_paint_bucket_settings_container.appendChild(
      side_panel_color_select_container_whole_image
    )
    side_panel_paint_bucket_settings_container.appendChild(
      side_panel_color_select_container_method
    )
    side_panel_paint_bucket_settings_container.appendChild(
      side_panel_color_select_container_mask_boundary
    )
    side_panel_paint_bucket_settings_container.appendChild(
      side_panel_color_select_container_mask_tolerance
    )

    side_panel_color_select_settings.appendChild(
      side_panel_color_select_settings_title
    )
    side_panel_color_select_settings.appendChild(
      side_panel_paint_bucket_settings_container
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
          this.maskCanvas.style.opacity = '0'
        } else {
          this.maskCanvas.style.opacity = String(this.mask_opacity) //change name
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

      if (option == this.maskBlendMode) {
        option_element.selected = true
      }
    })

    side_panel_mask_layer_blending_select.addEventListener(
      'change',
      (event) => {
        const selectedValue = (event.target as HTMLSelectElement)
          .value as MaskBlendMode
        this.maskBlendMode = selectedValue
        this.updateMaskColor()
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
      this.mask_opacity = parseFloat((event.target as HTMLInputElement)!.value)
      this.maskCanvas.style.opacity = String(this.mask_opacity)

      if (this.mask_opacity == 0) {
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
          this.imgCanvas.style.opacity = '0'
        } else {
          this.imgCanvas.style.opacity = '1'
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
      ComfyApp.clipspace?.imgs?.[ComfyApp.clipspace?.selectedIndex ?? 0]?.src ??
      ''
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

    const side_panel_separator1 = document.createElement('div')
    side_panel_separator1.classList.add('maskEditor_sidePanelSeparator')

    const side_panel_separator2 = document.createElement('div')
    side_panel_separator2.classList.add('maskEditor_sidePanelSeparator')

    side_panel.appendChild(side_panel_brush_settings)
    side_panel.appendChild(side_panel_paint_bucket_settings)
    side_panel.appendChild(side_panel_color_select_settings)
    side_panel.appendChild(side_panel_separator1)
    side_panel.appendChild(side_panel_image_layer_settings)

    side_panel_container.appendChild(side_panel)

    return side_panel_container
  }

  private async createTopBar() {
    var top_bar = document.createElement('div')
    top_bar.id = 'maskEditor_topBar'

    var top_bar_title_container = document.createElement('div')
    top_bar_title_container.id = 'maskEditor_topBarTitleContainer'

    var top_bar_title = document.createElement('h1')
    top_bar_title.id = 'maskEditor_topBarTitle'
    top_bar_title.innerText = 'ComfyUI'

    top_bar_title_container.appendChild(top_bar_title)

    var top_bar_shortcuts_container = document.createElement('div')
    top_bar_shortcuts_container.id = 'maskEditor_topBarShortcutsContainer'

    var top_bar_undo_button = document.createElement('div')
    top_bar_undo_button.id = 'maskEditor_topBarUndoButton'
    top_bar_undo_button.classList.add('maskEditor_topPanelIconButton')
    top_bar_undo_button.innerHTML =
      '<svg viewBox="0 0 15 15" style="width: 36px;height: 36px;pointer-events: none;fill: var(--input-text);"><path d="M8.77,12.18c-.25,0-.46-.2-.46-.46s.2-.46.46-.46c1.47,0,2.67-1.2,2.67-2.67,0-1.57-1.34-2.67-3.26-2.67h-3.98l1.43,1.43c.18.18.18.47,0,.64-.18.18-.47.18-.64,0l-2.21-2.21c-.18-.18-.18-.47,0-.64l2.21-2.21c.18-.18.47-.18.64,0,.18.18.18.47,0,.64l-1.43,1.43h3.98c2.45,0,4.17,1.47,4.17,3.58,0,1.97-1.61,3.58-3.58,3.58Z"></path> </svg>'

    top_bar_undo_button.addEventListener('click', () => {
      this.messageBroker.publish('undo')
    })

    var top_bar_redo_button = document.createElement('div')
    top_bar_redo_button.id = 'maskEditor_topBarRedoButton'
    top_bar_redo_button.classList.add('maskEditor_topPanelIconButton')
    top_bar_redo_button.innerHTML =
      '<svg viewBox="0 0 15 15" style="width: 36px;height: 36px;pointer-events: none;fill: var(--input-text);"> <path class="cls-1" d="M6.23,12.18c-1.97,0-3.58-1.61-3.58-3.58,0-2.11,1.71-3.58,4.17-3.58h3.98l-1.43-1.43c-.18-.18-.18-.47,0-.64.18-.18.46-.18.64,0l2.21,2.21c.09.09.13.2.13.32s-.05.24-.13.32l-2.21,2.21c-.18.18-.47.18-.64,0-.18-.18-.18-.47,0-.64l1.43-1.43h-3.98c-1.92,0-3.26,1.1-3.26,2.67,0,1.47,1.2,2.67,2.67,2.67.25,0,.46.2.46.46s-.2.46-.46.46Z"/></svg>'

    top_bar_redo_button.addEventListener('click', () => {
      this.messageBroker.publish('redo')
    })

    top_bar_shortcuts_container.appendChild(top_bar_undo_button)
    top_bar_shortcuts_container.appendChild(top_bar_redo_button)

    var top_bar_button_container = document.createElement('div')
    top_bar_button_container.id = 'maskEditor_topBarButtonContainer'

    var top_bar_clear_button = document.createElement('button')
    top_bar_clear_button.id = 'maskEditor_topBarClearButton'
    top_bar_clear_button.classList.add('maskEditor_topPanelButton')
    top_bar_clear_button.innerText = 'Clear'

    top_bar_clear_button.addEventListener('click', () => {
      this.maskCtx.clearRect(
        0,
        0,
        this.maskCanvas.width,
        this.maskCanvas.height
      )
      this.messageBroker.publish('saveState')
    })

    var top_bar_save_button = document.createElement('button')
    top_bar_save_button.id = 'maskEditor_topBarSaveButton'
    top_bar_save_button.classList.add('maskEditor_topPanelButton')
    top_bar_save_button.innerText = 'Save'
    this.saveButton = top_bar_save_button

    top_bar_save_button.addEventListener('click', () => {
      this.maskEditor.save()
    })

    var top_bar_cancel_button = document.createElement('button')
    top_bar_cancel_button.id = 'maskEditor_topBarCancelButton'
    top_bar_cancel_button.classList.add('maskEditor_topPanelButton')
    top_bar_cancel_button.innerText = 'Cancel'

    top_bar_cancel_button.addEventListener('click', () => {
      this.maskEditor.close()
    })

    top_bar_button_container.appendChild(top_bar_clear_button)
    top_bar_button_container.appendChild(top_bar_save_button)
    top_bar_button_container.appendChild(top_bar_cancel_button)

    top_bar.appendChild(top_bar_title_container)
    top_bar.appendChild(top_bar_shortcuts_container)
    top_bar.appendChild(top_bar_button_container)

    return top_bar
  }

  private createToolPanel() {
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
      //move logic to tool manager
      this.messageBroker.publish('setTool', Tools.Pen)
      for (let toolElement of toolElements) {
        if (toolElement != toolPanel_brushToolContainer) {
          toolElement.classList.remove('maskEditor_toolPanelContainerSelected')
        } else {
          toolElement.classList.add('maskEditor_toolPanelContainerSelected')
          this.brushSettingsHTML.style.display = 'flex'
          this.colorSelectSettingsHTML.style.display = 'none'
          this.paintBucketSettingsHTML.style.display = 'none'
        }
      }
      this.messageBroker.publish('setTool', Tools.Pen)
      this.pointerZone.style.cursor = 'none'
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
      //move logic to tool manager
      this.messageBroker.publish('setTool', Tools.Eraser)
      for (let toolElement of toolElements) {
        if (toolElement != toolPanel_eraserToolContainer) {
          toolElement.classList.remove('maskEditor_toolPanelContainerSelected')
        } else {
          toolElement.classList.add('maskEditor_toolPanelContainerSelected')
          this.brushSettingsHTML.style.display = 'flex'
          this.colorSelectSettingsHTML.style.display = 'none'
          this.paintBucketSettingsHTML.style.display = 'none'
        }
      }
      this.messageBroker.publish('setTool', Tools.Eraser)
      this.pointerZone.style.cursor = 'none'
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
      //move logic to tool manager
      this.messageBroker.publish('setTool', Tools.PaintBucket)
      for (let toolElement of toolElements) {
        if (toolElement != toolPanel_paintBucketToolContainer) {
          toolElement.classList.remove('maskEditor_toolPanelContainerSelected')
        } else {
          toolElement.classList.add('maskEditor_toolPanelContainerSelected')
          this.brushSettingsHTML.style.display = 'none'
          this.colorSelectSettingsHTML.style.display = 'none'
          this.paintBucketSettingsHTML.style.display = 'flex'
        }
      }
      this.messageBroker.publish('setTool', Tools.PaintBucket)
      this.pointerZone.style.cursor =
        "url('/cursor/paintBucket.png') 30 25, auto"
      this.brush.style.opacity = '0'
    })

    var toolPanel_paintBucketToolIndicator = document.createElement('div')
    toolPanel_paintBucketToolIndicator.classList.add(
      'maskEditor_toolPanelIndicator'
    )

    toolPanel_paintBucketToolContainer.appendChild(
      toolPanel_paintBucketToolIndicator
    )

    //color select tool

    var toolPanel_colorSelectToolContainer = document.createElement('div')
    toolPanel_colorSelectToolContainer.classList.add(
      'maskEditor_toolPanelContainer'
    )
    toolPanel_colorSelectToolContainer.innerHTML = `
    <svg viewBox="0 0 44 44">
      <path class="cls-1" d="M30.29,13.72c-1.09-1.1-2.85-1.09-3.94,0l-2.88,2.88-.75-.75c-.2-.19-.51-.19-.71,0-.19.2-.19.51,0,.71l1.4,1.4-9.59,9.59c-.35.36-.54.82-.54,1.32,0,.14,0,.28.05.41-.05.04-.1.08-.15.13-.39.39-.39,1.01,0,1.4.38.39,1.01.39,1.4,0,.04-.04.08-.09.11-.13.14.04.3.06.45.06.5,0,.97-.19,1.32-.55l9.59-9.59,1.38,1.38c.1.09.22.14.35.14s.26-.05.35-.14c.2-.2.2-.52,0-.71l-.71-.72,2.88-2.89c1.08-1.08,1.08-2.85-.01-3.94ZM19.43,25.82h-2.46l7.15-7.15,1.23,1.23-5.92,5.92Z"/>
    </svg>
    `
    toolElements.push(toolPanel_colorSelectToolContainer)
    toolPanel_colorSelectToolContainer.addEventListener('click', () => {
      this.messageBroker.publish('setTool', 'colorSelect')
      for (let toolElement of toolElements) {
        if (toolElement != toolPanel_colorSelectToolContainer) {
          toolElement.classList.remove('maskEditor_toolPanelContainerSelected')
        } else {
          toolElement.classList.add('maskEditor_toolPanelContainerSelected')
          this.brushSettingsHTML.style.display = 'none'
          this.paintBucketSettingsHTML.style.display = 'none'
          this.colorSelectSettingsHTML.style.display = 'flex'
        }
      }
      this.messageBroker.publish('setTool', Tools.ColorSelect)
      this.pointerZone.style.cursor =
        "url('/cursor/colorSelect.png') 15 25, auto"
      this.brush.style.opacity = '0'
    })

    var toolPanel_colorSelectToolIndicator = document.createElement('div')
    toolPanel_colorSelectToolIndicator.classList.add(
      'maskEditor_toolPanelIndicator'
    )
    toolPanel_colorSelectToolContainer.appendChild(
      toolPanel_colorSelectToolIndicator
    )

    pen_tool_panel.appendChild(toolPanel_brushToolContainer)
    pen_tool_panel.appendChild(toolPanel_eraserToolContainer)
    pen_tool_panel.appendChild(toolPanel_paintBucketToolContainer)
    pen_tool_panel.appendChild(toolPanel_colorSelectToolContainer)

    var pen_tool_panel_change_tool_button = document.createElement('button')
    pen_tool_panel_change_tool_button.id =
      'maskEditor_toolPanelChangeToolButton'
    pen_tool_panel_change_tool_button.innerText = 'change to Eraser'

    return pen_tool_panel
  }

  private createPointerZone() {
    const pointer_zone = document.createElement('div')
    pointer_zone.id = 'maskEditor_pointerZone'

    this.pointerZone = pointer_zone

    pointer_zone.addEventListener('pointerdown', (event: PointerEvent) => {
      this.messageBroker.publish('pointerDown', event)
    })

    pointer_zone.addEventListener('pointermove', (event: PointerEvent) => {
      this.messageBroker.publish('pointerMove', event)
    })

    pointer_zone.addEventListener('pointerup', (event: PointerEvent) => {
      this.messageBroker.publish('pointerUp', event)
    })

    pointer_zone.addEventListener('pointerleave', (event: PointerEvent) => {
      this.brush.style.opacity = '0'
      this.pointerZone.style.cursor = ''
    })

    pointer_zone.addEventListener('touchstart', (event: TouchEvent) => {
      this.messageBroker.publish('handleTouchStart', event)
    })

    pointer_zone.addEventListener('touchmove', (event: TouchEvent) => {
      this.messageBroker.publish('handleTouchMove', event)
    })

    pointer_zone.addEventListener('touchend', (event: TouchEvent) => {
      this.messageBroker.publish('handleTouchEnd', event)
    })

    pointer_zone.addEventListener('wheel', (event) =>
      this.messageBroker.publish('wheel', event)
    )

    pointer_zone.addEventListener(
      'pointerenter',
      async (event: PointerEvent) => {
        this.updateCursor()
      }
    )

    return pointer_zone
  }

  async screenToCanvas(clientPoint: Point): Promise<Point> {
    // Get the bounding rectangles for both elements
    const zoomRatio = await this.messageBroker.pull('zoomRatio')
    const canvasRect = this.maskCanvas.getBoundingClientRect()

    // Calculate the offset between pointer zone and canvas
    const offsetX = clientPoint.x - canvasRect.left + this.toolPanel.clientWidth
    const offsetY = clientPoint.y - canvasRect.top + 44 // 44 is the height of the top menu

    const x = offsetX / zoomRatio
    const y = offsetY / zoomRatio

    return { x: x, y: y }
  }

  private setEventHandler() {
    this.maskCanvas.addEventListener('contextmenu', (event: Event) => {
      event.preventDefault()
    })

    this.rootElement.addEventListener('contextmenu', (event: Event) => {
      event.preventDefault()
    })

    this.rootElement.addEventListener('dragstart', (event) => {
      if (event.ctrlKey) {
        event.preventDefault()
      }
    })
  }

  private async createBrush() {
    var brush = document.createElement('div')
    const brushSettings = await this.messageBroker.pull('brushSettings')
    brush.id = 'maskEditor_brush'

    var brush_preview_gradient = document.createElement('div')
    brush_preview_gradient.id = 'maskEditor_brushPreviewGradient'

    brush.appendChild(brush_preview_gradient)

    this.brush = brush
    this.brushPreviewGradient = brush_preview_gradient

    return brush
  }

  async setImages(imgCanvas: HTMLCanvasElement) {
    const imgCtx = imgCanvas.getContext('2d', { willReadFrequently: true })
    const maskCtx = this.maskCtx
    const maskCanvas = this.maskCanvas

    imgCtx!.clearRect(0, 0, this.imgCanvas.width, this.imgCanvas.height)
    maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height)

    const alpha_url = new URL(
      ComfyApp.clipspace?.imgs?.[ComfyApp.clipspace?.selectedIndex ?? 0]?.src ??
        ''
    )
    alpha_url.searchParams.delete('channel')
    alpha_url.searchParams.delete('preview')
    alpha_url.searchParams.set('channel', 'a')
    let mask_image: HTMLImageElement = await this.loadImage(alpha_url)

    // original image load
    if (
      !ComfyApp.clipspace?.imgs?.[ComfyApp.clipspace?.selectedIndex ?? 0]?.src
    ) {
      throw new Error(
        'Unable to access image source - clipspace or image is null'
      )
    }

    const rgb_url = new URL(
      ComfyApp.clipspace.imgs[ComfyApp.clipspace.selectedIndex].src
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

    maskCanvas.width = this.image.width
    maskCanvas.height = this.image.height

    await this.invalidateCanvas(this.image, mask_image)
    this.messageBroker.publish('initZoomPan', [this.image, this.rootElement])
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
    await this.prepare_mask(
      mask_image,
      this.maskCanvas,
      maskCtx!,
      await this.getMaskColor()
    )
  }

  private async prepare_mask(
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

  private async updateMaskColor() {
    // update mask canvas css styles
    const maskCanvasStyle = this.getMaskCanvasStyle()
    this.maskCanvas.style.mixBlendMode = maskCanvasStyle.mixBlendMode
    this.maskCanvas.style.opacity = maskCanvasStyle.opacity.toString()

    // update mask canvas rgb colors
    const maskColor = await this.getMaskColor()
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

  getMaskCanvasStyle() {
    if (this.maskBlendMode === MaskBlendMode.Negative) {
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

  private loadImage(imagePath: URL): Promise<HTMLImageElement> {
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

  async updateBrushPreview() {
    const cursorPoint = await this.messageBroker.pull('cursorPoint')
    const pan_offset = await this.messageBroker.pull('panOffset')
    const brushSettings = await this.messageBroker.pull('brushSettings')
    const zoom_ratio = await this.messageBroker.pull('zoomRatio')
    const centerX = cursorPoint.x + pan_offset.x
    const centerY = cursorPoint.y + pan_offset.y
    const brush = this.brush
    const hardness = brushSettings.hardness
    const extendedSize = brushSettings.size * (2 - hardness) * 2 * zoom_ratio

    this.brushSizeSlider.value = String(brushSettings.size)
    this.brushHardnessSlider.value = String(hardness)

    brush.style.width = extendedSize + 'px'
    brush.style.height = extendedSize + 'px'
    brush.style.left = centerX - extendedSize / 2 + 'px'
    brush.style.top = centerY - extendedSize / 2 + 'px'

    if (hardness === 1) {
      this.brushPreviewGradient.style.background = 'rgba(255, 0, 0, 0.5)'
      return
    }

    const opacityStop = hardness / 4 + 0.25

    this.brushPreviewGradient.style.background = `
        radial-gradient(
            circle,
            rgba(255, 0, 0, 0.5) 0%,
            rgba(255, 0, 0, ${opacityStop}) ${hardness * 100}%,
            rgba(255, 0, 0, 0) 100%
        )
    `
  }

  getMaskBlendMode() {
    return this.maskBlendMode
  }

  setSidebarImage(src: string) {
    this.sidebarImage.src = src
  }

  async getMaskColor() {
    if (this.maskBlendMode === MaskBlendMode.Black) {
      return { r: 0, g: 0, b: 0 }
    }
    if (this.maskBlendMode === MaskBlendMode.White) {
      return { r: 255, g: 255, b: 255 }
    }
    if (this.maskBlendMode === MaskBlendMode.Negative) {
      // negative effect only works with white color
      return { r: 255, g: 255, b: 255 }
    }

    return { r: 0, g: 0, b: 0 }
  }

  async getMaskFillStyle() {
    const maskColor = await this.getMaskColor()

    return 'rgb(' + maskColor.r + ',' + maskColor.g + ',' + maskColor.b + ')'
  }

  async setCanvasBackground() {
    if (this.maskBlendMode === MaskBlendMode.White) {
      this.canvasBackground.style.background = 'black'
    } else {
      this.canvasBackground.style.background = 'white'
    }
  }

  getMaskCanvas() {
    return this.maskCanvas
  }

  getImgCanvas() {
    return this.imgCanvas
  }

  getImage() {
    return this.image
  }

  setBrushOpacity(opacity: number) {
    this.brush.style.opacity = String(opacity)
  }

  setSaveButtonEnabled(enabled: boolean) {
    this.saveButton.disabled = !enabled
  }

  setSaveButtonText(text: string) {
    this.saveButton.innerText = text
  }

  handlePaintBucketCursor(isPaintBucket: boolean) {
    if (isPaintBucket) {
      this.pointerZone.style.cursor =
        "url('/cursor/paintBucket.png') 30 25, auto"
    } else {
      this.pointerZone.style.cursor = 'none'
    }
  }

  handlePanCursor(isPanning: boolean) {
    if (isPanning) {
      this.pointerZone.style.cursor = 'grabbing'
    } else {
      this.pointerZone.style.cursor = 'none'
    }
  }

  setBrushVisibility(visible: boolean) {
    this.brush.style.opacity = visible ? '1' : '0'
  }

  setBrushPreviewGradientVisibility(visible: boolean) {
    this.brushPreviewGradient.style.display = visible ? 'block' : 'none'
  }

  async updateCursor() {
    const currentTool = await this.messageBroker.pull('currentTool')
    if (currentTool === Tools.PaintBucket) {
      this.pointerZone.style.cursor =
        "url('/cursor/paintBucket.png') 30 25, auto"
      this.setBrushOpacity(0)
    } else if (currentTool === Tools.ColorSelect) {
      this.pointerZone.style.cursor =
        "url('/cursor/colorSelect.png') 15 25, auto"
      this.setBrushOpacity(0)
    } else {
      this.pointerZone.style.cursor = 'none'
      this.setBrushOpacity(1)
    }

    this.updateBrushPreview()
    this.setBrushPreviewGradientVisibility(false)
  }
}

class ToolManager {
  maskEditor: MaskEditorDialog
  messageBroker: MessageBroker
  mouseDownPoint: Point | null = null

  currentTool: Tools = Tools.Pen
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

    if (tool != Tools.ColorSelect) {
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

    //paint bucket
    if (this.currentTool === Tools.PaintBucket && event.button === 0) {
      const offset = { x: event.offsetX, y: event.offsetY }
      const coords_canvas = await this.messageBroker.pull(
        'screenToCanvas',
        offset
      )
      this.messageBroker.publish('paintBucketFill', coords_canvas)
      this.messageBroker.publish('saveState')
      return
    }

    if (this.currentTool === Tools.ColorSelect && event.button === 0) {
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

    var isDrawingTool = [Tools.Pen, Tools.Eraser].includes(this.currentTool)
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

    var isDrawingTool = [Tools.Pen, Tools.Eraser].includes(this.currentTool)
    if (!isDrawingTool) return

    // alt + right mouse button hold brush adjustment
    if (
      this.isAdjustingBrush &&
      (this.currentTool === Tools.Pen || this.currentTool === Tools.Eraser) &&
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

class PanAndZoomManager {
  maskEditor: MaskEditorDialog
  messageBroker: MessageBroker

  DOUBLE_TAP_DELAY: number = 300
  lastTwoFingerTap: number = 0

  isTouchZooming: boolean = false
  lastTouchZoomDistance: number = 0
  lastTouchMidPoint: Point = { x: 0, y: 0 }
  lastTouchPoint: Point = { x: 0, y: 0 }

  zoom_ratio: number = 1
  pan_offset: Offset = { x: 0, y: 0 }

  mouseDownPoint: Point | null = null
  initialPan: Offset = { x: 0, y: 0 }

  canvasContainer: HTMLElement | null = null
  maskCanvas: HTMLCanvasElement | null = null

  image: HTMLImageElement | null = null

  cursorPoint: Point = { x: 0, y: 0 }

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()

    this.addListeners()
    this.addPullTopics()
  }

  private addListeners() {
    this.messageBroker.subscribe(
      'initZoomPan',
      async (args: [HTMLImageElement, HTMLElement]) => {
        await this.initializeCanvasPanZoom(args[0], args[1])
      }
    )

    this.messageBroker.subscribe('panStart', async (event: PointerEvent) => {
      this.handlePanStart(event)
    })

    this.messageBroker.subscribe('panMove', async (event: PointerEvent) => {
      this.handlePanMove(event)
    })

    this.messageBroker.subscribe('zoom', async (event: WheelEvent) => {
      this.zoom(event)
    })

    this.messageBroker.subscribe('cursorPoint', async (point: Point) => {
      this.updateCursorPosition(point)
    })

    this.messageBroker.subscribe(
      'handleTouchStart',
      async (event: TouchEvent) => {
        this.handleTouchStart(event)
      }
    )

    this.messageBroker.subscribe(
      'handleTouchMove',
      async (event: TouchEvent) => {
        this.handleTouchMove(event)
      }
    )

    this.messageBroker.subscribe(
      'handleTouchEnd',
      async (event: TouchEvent) => {
        this.handleTouchEnd(event)
      }
    )
  }

  private addPullTopics() {
    this.messageBroker.createPullTopic(
      'cursorPoint',
      async () => this.cursorPoint
    )
    this.messageBroker.createPullTopic('zoomRatio', async () => this.zoom_ratio)
    this.messageBroker.createPullTopic('panOffset', async () => this.pan_offset)
  }

  handleTouchStart(event: TouchEvent) {
    event.preventDefault()
    if ((event.touches[0] as any).touchType === 'stylus') return
    this.messageBroker.publish('setBrushVisibility', false)
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
        this.lastTouchMidPoint = midpoint
      }
    } else if (event.touches.length === 1) {
      this.lastTouchPoint = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      }
    }
  }

  async handleTouchMove(event: TouchEvent) {
    event.preventDefault()
    if ((event.touches[0] as any).touchType === 'stylus') return

    this.lastTwoFingerTap = 0
    if (this.isTouchZooming && event.touches.length === 2) {
      // Handle zooming
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

      // Handle panning - calculate the movement of the midpoint
      if (this.lastTouchMidPoint) {
        const deltaX = midpoint.x - this.lastTouchMidPoint.x
        const deltaY = midpoint.y - this.lastTouchMidPoint.y

        // Apply the pan
        this.pan_offset.x += deltaX
        this.pan_offset.y += deltaY
      }

      // Get touch position relative to the container
      if (this.maskCanvas === null) {
        this.maskCanvas = await this.messageBroker.pull('maskCanvas')
      }
      const rect = this.maskCanvas!.getBoundingClientRect()
      const touchX = midpoint.x - rect.left
      const touchY = midpoint.y - rect.top

      // Calculate new pan position based on zoom
      const scaleFactor = newZoom / oldZoom
      this.pan_offset.x += touchX - touchX * scaleFactor
      this.pan_offset.y += touchY - touchY * scaleFactor

      this.invalidatePanZoom()
      this.lastTouchZoomDistance = newDistance
      this.lastTouchMidPoint = midpoint
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
    ) {
      return
    }

    this.isTouchZooming = false
    this.lastTouchMidPoint = { x: 0, y: 0 }

    if (event.touches.length === 0) {
      this.lastTouchPoint = { x: 0, y: 0 }
    } else if (event.touches.length === 1) {
      this.lastTouchPoint = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      }
    }
  }

  private getTouchDistance(touches: TouchList) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getTouchMidpoint(touches: TouchList) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    }
  }

  private async handleSingleTouchPan(touch: Touch) {
    if (this.lastTouchPoint === null) {
      this.lastTouchPoint = { x: touch.clientX, y: touch.clientY }
      return
    }

    const deltaX = touch.clientX - this.lastTouchPoint.x
    const deltaY = touch.clientY - this.lastTouchPoint.y

    this.pan_offset.x += deltaX
    this.pan_offset.y += deltaY

    await this.invalidatePanZoom()

    this.lastTouchPoint = { x: touch.clientX, y: touch.clientY }
  }

  private updateCursorPosition(clientPoint: Point) {
    var cursorX = clientPoint.x - this.pan_offset.x
    var cursorY = clientPoint.y - this.pan_offset.y

    this.cursorPoint = { x: cursorX, y: cursorY }
  }

  //prob redundant
  handleDoubleTap() {
    this.messageBroker.publish('undo')
    // Add any additional logic needed after undo
  }

  async zoom(event: WheelEvent) {
    // Store original cursor position
    const cursorPoint = { x: event.clientX, y: event.clientY }

    // zoom canvas
    const oldZoom = this.zoom_ratio
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    this.zoom_ratio = Math.max(
      0.2,
      Math.min(10.0, this.zoom_ratio * zoomFactor)
    )
    const newZoom = this.zoom_ratio

    const maskCanvas = await this.messageBroker.pull('maskCanvas')

    // Get mouse position relative to the container
    const rect = maskCanvas.getBoundingClientRect()
    const mouseX = cursorPoint.x - rect.left
    const mouseY = cursorPoint.y - rect.top

    // Calculate new pan position
    const scaleFactor = newZoom / oldZoom
    this.pan_offset.x += mouseX - mouseX * scaleFactor
    this.pan_offset.y += mouseY - mouseY * scaleFactor

    // Update pan and zoom immediately
    await this.invalidatePanZoom()

    // Update cursor position with new pan values
    this.updateCursorPosition(cursorPoint)

    // Update brush preview after pan/zoom is complete
    requestAnimationFrame(() => {
      this.messageBroker.publish('updateBrushPreview')
    })
  }

  async initializeCanvasPanZoom(
    image: HTMLImageElement,
    rootElement: HTMLElement
  ) {
    // Get side panel width
    let sidePanelWidth = 220
    let topBarHeight = 44

    // Calculate available width accounting for both side panels
    let availableWidth = rootElement.clientWidth - 2 * sidePanelWidth
    let availableHeight = rootElement.clientHeight - topBarHeight

    // Initial dimensions
    let drawWidth = image.width
    let drawHeight = image.height

    // First check if width needs scaling
    if (drawWidth > availableWidth) {
      drawWidth = availableWidth
      drawHeight = (drawWidth / image.width) * image.height
    }

    // Then check if height needs scaling
    if (drawHeight > availableHeight) {
      drawHeight = availableHeight
      drawWidth = (drawHeight / image.height) * image.width
    }

    if (this.image === null) {
      this.image = image
    }

    this.zoom_ratio = drawWidth / image.width

    // Center the canvas in the available space
    const canvasX = sidePanelWidth + (availableWidth - drawWidth) / 2
    const canvasY = (availableHeight - drawHeight) / 2

    this.pan_offset.x = canvasX
    this.pan_offset.y = canvasY

    await this.invalidatePanZoom()
  }

  //probably move to PanZoomManager
  async invalidatePanZoom() {
    // Single validation check upfront
    if (
      !this.image?.width ||
      !this.image?.height ||
      !this.pan_offset ||
      !this.zoom_ratio
    ) {
      console.warn('Missing required properties for pan/zoom')
      return
    }

    // Now TypeScript knows these are non-null
    const raw_width = this.image.width * this.zoom_ratio
    const raw_height = this.image.height * this.zoom_ratio

    // Adjust pan offset
    this.pan_offset.x = Math.max(10 - raw_width, this.pan_offset.x)
    this.pan_offset.y = Math.max(10 - raw_height, this.pan_offset.y)

    // Get canvas container
    this.canvasContainer ??=
      await this.messageBroker?.pull('getCanvasContainer')
    if (!this.canvasContainer) return

    // Apply styles
    Object.assign(this.canvasContainer.style, {
      width: `${raw_width}px`,
      height: `${raw_height}px`,
      left: `${this.pan_offset.x}px`,
      top: `${this.pan_offset.y}px`
    })
  }

  private handlePanStart(event: PointerEvent) {
    let coords_canvas = this.messageBroker.pull('screenToCanvas', {
      x: event.offsetX,
      y: event.offsetY
    })
    this.mouseDownPoint = { x: event.clientX, y: event.clientY }
    this.messageBroker.publish('panCursor', true)
    this.initialPan = this.pan_offset
    return
  }

  private handlePanMove(event: PointerEvent) {
    if (this.mouseDownPoint === null) throw new Error('mouseDownPoint is null')

    let deltaX = this.mouseDownPoint.x - event.clientX
    let deltaY = this.mouseDownPoint.y - event.clientY

    let pan_x = this.initialPan.x - deltaX
    let pan_y = this.initialPan.y - deltaY

    this.pan_offset = { x: pan_x, y: pan_y }

    this.invalidatePanZoom()
  }
}

class MessageBroker {
  private pushTopics: Record<string, Callback[]> = {}
  private pullTopics: Record<string, (data?: any) => Promise<any>> = {}

  constructor() {
    this.registerListeners()
  }

  // Push

  private registerListeners() {
    // Register listeners
    this.createPushTopic('panStart')
    this.createPushTopic('paintBucketFill')
    this.createPushTopic('saveState')
    this.createPushTopic('brushAdjustmentStart')
    this.createPushTopic('drawStart')
    this.createPushTopic('panMove')
    this.createPushTopic('updateBrushPreview')
    this.createPushTopic('brushAdjustment')
    this.createPushTopic('draw')
    this.createPushTopic('paintBucketCursor')
    this.createPushTopic('panCursor')
    this.createPushTopic('drawEnd')
    this.createPushTopic('zoom')
    this.createPushTopic('undo')
    this.createPushTopic('redo')
    this.createPushTopic('cursorPoint')
    this.createPushTopic('panOffset')
    this.createPushTopic('zoomRatio')
    this.createPushTopic('getMaskCanvas')
    this.createPushTopic('getCanvasContainer')
    this.createPushTopic('screenToCanvas')
    this.createPushTopic('isKeyPressed')
    this.createPushTopic('isCombinationPressed')
    this.createPushTopic('setPaintBucketTolerance')
    this.createPushTopic('setBrushSize')
    this.createPushTopic('setBrushHardness')
    this.createPushTopic('setBrushOpacity')
    this.createPushTopic('setBrushShape')
    this.createPushTopic('initZoomPan')
    this.createPushTopic('setTool')
    this.createPushTopic('pointerDown')
    this.createPushTopic('pointerMove')
    this.createPushTopic('pointerUp')
    this.createPushTopic('wheel')
    this.createPushTopic('initPaintBucketTool')
    this.createPushTopic('setBrushVisibility')
    this.createPushTopic('setBrushPreviewGradientVisibility')
    this.createPushTopic('handleTouchStart')
    this.createPushTopic('handleTouchMove')
    this.createPushTopic('handleTouchEnd')
    this.createPushTopic('colorSelectFill')
    this.createPushTopic('setColorSelectTolerance')
    this.createPushTopic('setLivePreview')
    this.createPushTopic('updateCursor')
    this.createPushTopic('setColorComparisonMethod')
    this.createPushTopic('clearLastPoint')
    this.createPushTopic('setWholeImage')
    this.createPushTopic('setMaskBoundary')
    this.createPushTopic('setMaskTolerance')
  }

  /**
   * Creates a new push topic (listener is notified)
   *
   * @param {string} topicName - The name of the topic to create.
   * @throws {Error} If the topic already exists.
   */
  createPushTopic(topicName: string) {
    if (this.topicExists(this.pushTopics, topicName)) {
      throw new Error('Topic already exists')
    }
    this.pushTopics[topicName] = []
  }

  /**
   * Subscribe a callback function to the given topic.
   *
   * @param {string} topicName - The name of the topic to subscribe to.
   * @param {Callback} callback - The callback function to be subscribed.
   * @throws {Error} If the topic does not exist.
   */
  subscribe(topicName: string, callback: Callback) {
    if (!this.topicExists(this.pushTopics, topicName)) {
      throw new Error(`Topic "${topicName}" does not exist!`)
    }
    this.pushTopics[topicName].push(callback)
  }

  /**
   * Removes a callback function from the list of subscribers for a given topic.
   *
   * @param {string} topicName - The name of the topic to unsubscribe from.
   * @param {Callback} callback - The callback function to remove from the subscribers list.
   * @throws {Error} If the topic does not exist in the list of topics.
   */
  unsubscribe(topicName: string, callback: Callback) {
    if (!this.topicExists(this.pushTopics, topicName)) {
      throw new Error('Topic does not exist')
    }
    const index = this.pushTopics[topicName].indexOf(callback)
    if (index > -1) {
      this.pushTopics[topicName].splice(index, 1)
    }
  }

  /**
   * Publishes data to a specified topic with variable number of arguments.
   * @param {string} topicName - The name of the topic to publish to.
   * @param {...any[]} args - Variable number of arguments to pass to subscribers
   * @throws {Error} If the specified topic does not exist.
   */
  publish(topicName: string, ...args: any[]) {
    if (!this.topicExists(this.pushTopics, topicName)) {
      throw new Error(`Topic "${topicName}" does not exist!`)
    }

    this.pushTopics[topicName].forEach((callback) => {
      callback(...args)
    })
  }

  // Pull

  /**
   * Creates a new pull topic (listener must request data)
   *
   * @param {string} topicName - The name of the topic to create.
   * @param {() => Promise<any>} callBack - The callback function to be called when data is requested.
   * @throws {Error} If the topic already exists.
   */
  createPullTopic(topicName: string, callBack: (data?: any) => Promise<any>) {
    if (this.topicExists(this.pullTopics, topicName)) {
      throw new Error('Topic already exists')
    }
    this.pullTopics[topicName] = callBack
  }

  /**
   * Requests data from a specified pull topic.
   * @param {string} topicName - The name of the topic to request data from.
   * @returns {Promise<any>} - The data from the pull topic.
   * @throws {Error} If the specified topic does not exist.
   */
  async pull(topicName: string, data?: any): Promise<any> {
    if (!this.topicExists(this.pullTopics, topicName)) {
      throw new Error('Topic does not exist')
    }

    const callBack = this.pullTopics[topicName]
    try {
      const result = await callBack(data)
      return result
    } catch (error) {
      console.error(`Error pulling data from topic "${topicName}":`, error)
      throw error
    }
  }

  // Helper Methods

  /**
   * Checks if a topic exists in the given topics object.
   * @param {Record<string, any>} topics - The topics object to check.
   * @param {string} topicName - The name of the topic to check.
   * @returns {boolean} - True if the topic exists, false otherwise.
   */
  private topicExists(topics: Record<string, any>, topicName: string): boolean {
    return topics.hasOwnProperty(topicName)
  }
}

class KeyboardManager {
  private keysDown: string[] = []
  private maskEditor: MaskEditorDialog
  private messageBroker: MessageBroker

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
    document.addEventListener('keydown', (event) => this.handleKeyDown(event))
    document.addEventListener('keyup', (event) => this.handleKeyUp(event))
    window.addEventListener('blur', () => this.clearKeys())
  }

  removeListeners() {
    document.removeEventListener('keydown', (event) =>
      this.handleKeyDown(event)
    )
    document.removeEventListener('keyup', (event) => this.handleKeyUp(event))
  }

  private clearKeys() {
    this.keysDown = []
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (!this.keysDown.includes(event.key)) {
      this.keysDown.push(event.key)
    }
    //if (this.redoCombinationPressed()) return
    //this.undoCombinationPressed()
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.keysDown = this.keysDown.filter((key) => key !== event.key)
  }

  private isKeyDown(key: string) {
    return this.keysDown.includes(key)
  }

  // combinations

  private undoCombinationPressed() {
    const combination = ['ctrl', 'z']
    const keysDownLower = this.keysDown.map((key) => key.toLowerCase())
    const result = combination.every((key) => keysDownLower.includes(key))
    if (result) this.messageBroker.publish('undo')
    return result
  }

  private redoCombinationPressed() {
    const combination = ['ctrl', 'shift', 'z']
    const keysDownLower = this.keysDown.map((key) => key.toLowerCase())
    const result = combination.every((key) => keysDownLower.includes(key))
    if (result) this.messageBroker.publish('redo')
    return result
  }
}

app.registerExtension({
  name: 'Comfy.MaskEditor',
  settings: [
    {
      id: 'Comfy.MaskEditor.UseNewEditor',
      category: ['Comfy', 'Masking'],
      name: 'Use new mask editor',
      tooltip: 'Switch to the new mask editor interface',
      type: 'boolean',
      defaultValue: true,
      experimental: true
    }
  ],
  init(app) {
    // Create function before assignment
    function openMaskEditor(): void {
      const useNewEditor = app.extensionManager.setting.get(
        'Comfy.MaskEditor.UseNewEditor'
      )
      if (useNewEditor) {
        const dlg = MaskEditorDialog.getInstance() as any
        if (dlg?.isOpened && !dlg.isOpened()) {
          dlg.show()
        }
      } else {
        const dlg = MaskEditorDialogOld.getInstance() as any
        if (dlg?.isOpened && !dlg.isOpened()) {
          dlg.show()
        }
      }
    }

    // Assign the created function
    ;(ComfyApp as any).open_maskeditor = openMaskEditor

    // Ensure boolean return type
    const context_predicate = (): boolean => {
      return !!(
        ComfyApp.clipspace &&
        ComfyApp.clipspace.imgs &&
        ComfyApp.clipspace.imgs.length > 0
      )
    }

    ClipspaceDialog.registerButton(
      'MaskEditor',
      context_predicate,
      openMaskEditor
    )
  }
})
