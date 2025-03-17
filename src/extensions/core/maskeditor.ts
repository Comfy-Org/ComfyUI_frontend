import { debounce } from 'lodash'

import { t } from '@/i18n'

import { api } from '../../scripts/api'
import { app } from '../../scripts/app'
import { ComfyApp } from '../../scripts/app'
import { $el, ComfyDialog } from '../../scripts/ui'
import { getStorageValue, setStorageValue } from '../../scripts/utils'
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
    align-items: center;
    overflow-y: hidden;
    width: 220px;
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
    border-radius: 50%;
    border: 1px solid var(--border-color);
    pointer-events: auto;
    transition: background 0.1s;
    margin-left: 7.5px;
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

  #maskEditor_sidePanelBrushShapeSquare {
    width: 35px;
    height: 35px;
    margin: 5px;
    border: 1px solid var(--border-color);
    pointer-events: auto;
    transition: background 0.1s;
  }

  .maskEditor_brushShape_dark {
    background: transparent;
  }

  .maskEditor_brushShape_dark:hover {
    background: var(--p-surface-900);
  }

  .maskEditor_brushShape_light {
    background: transparent;
  }

  .maskEditor_brushShape_light:hover {
    background: var(--comfy-menu-bg);
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
    width: 4rem;
    z-index: 8888;
    background: var(--comfy-menu-bg);
    display: flex;
    flex-direction: column;
  }
  .maskEditor_toolPanelContainer {
    width: 4rem;
    height: 4rem;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    transition: background-color 0.2s;
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

  .maskEditor_toolPanelContainerDark:hover {
    background-color: var(--p-surface-800);
  }

  .maskEditor_toolPanelContainerLight:hover {
    background-color: var(--p-surface-300);
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
    width: calc(100% - 4rem - 220px);
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
    right: 0;
    width: 200px;
  }
  #maskEditor_topBarShortcutsContainer {
    display: flex;
    gap: 10px;
    margin-left: 5px;
  }

  .maskEditor_topPanelIconButton_dark {
    width: 50px;
    height: 30px;
    pointer-events: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: background-color 0.1s;
    background: var(--p-surface-800);
    border: 1px solid var(--p-form-field-border-color);
    border-radius: 10px;
  }

  .maskEditor_topPanelIconButton_dark:hover {
      background-color: var(--p-surface-900);
  }

  .maskEditor_topPanelIconButton_dark svg {
    width: 25px;
    height: 25px;
    pointer-events: none;
    fill: var(--input-text);
  }

  .maskEditor_topPanelIconButton_light {
    width: 50px;
    height: 30px;
    pointer-events: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: background-color 0.1s;
    background: var(--comfy-menu-bg);
    border: 1px solid var(--p-form-field-border-color);
    border-radius: 10px;
  }

  .maskEditor_topPanelIconButton_light:hover {
      background-color: var(--p-surface-300);
  }

  .maskEditor_topPanelIconButton_light svg {
    width: 25px;
    height: 25px;
    pointer-events: none;
    fill: var(--input-text);
  }

  .maskEditor_topPanelButton_dark {
    height: 30px;
    background: var(--p-surface-800);
    border: 1px solid var(--p-form-field-border-color);
    border-radius: 10px;
    color: var(--input-text);
    font-family: sans-serif;
    pointer-events: auto;
    transition: 0.1s;
    width: 60px;
  }

  .maskEditor_topPanelButton_dark:hover {
    background-color: var(--p-surface-900);
  }

  .maskEditor_topPanelButton_light {
    height: 30px;
    background: var(--comfy-menu-bg);
    border: 1px solid var(--p-form-field-border-color);
    border-radius: 10px;
    color: var(--input-text);
    font-family: sans-serif;
    pointer-events: auto;
    transition: 0.1s;
    width: 60px;
  }

  .maskEditor_topPanelButton_light:hover {
    background-color: var(--p-surface-300);
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

  .maskEditor_sidePanelContainerColumn {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .maskEditor_sidePanelContainerRow {
    display: flex;
    flex-direction: row;
    gap: 10px;
    align-items: center;
    min-height: 24px;
    position: relative;
  }

  .maskEditor_accent_bg_dark {
    background: var(--p-surface-800);
  }

  .maskEditor_accent_bg_very_dark {
    background: var(--p-surface-900);
  }

  .maskEditor_accent_bg_light {
    background: var(--p-surface-300);
  }

  .maskEditor_accent_bg_very_light {
    background: var(--comfy-menu-bg);
  }

  #maskEditor_paintBucketSettings {
    display: none;
  }

  #maskEditor_colorSelectSettings {
    display: none;
  }

  .maskEditor_sidePanelToggleContainer {
    cursor: pointer;
    display: inline-block;
    position: absolute;
    right: 0;
  }

  .maskEditor_toggle_bg_dark {
    background: var(--p-surface-700);
  }

  .maskEditor_toggle_bg_light {
    background: var(--p-surface-300);
  }

  .maskEditor_sidePanelToggleSwitch {
    display: inline-block;
    border-radius: 16px;
    width: 40px;
    height: 24px;
    position: relative;
    vertical-align: middle;
    transition: background 0.25s;
  }
  .maskEditor_sidePanelToggleSwitch:before, .maskEditor_sidePanelToggleSwitch:after {
    content: "";
  }
  .maskEditor_sidePanelToggleSwitch:before {
    display: block;
    background: linear-gradient(to bottom, #fff 0%, #eee 100%);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    position: absolute;
    top: 4px;
    left: 4px;
    transition: ease 0.2s;
  }
  .maskEditor_sidePanelToggleContainer:hover .maskEditor_sidePanelToggleSwitch:before {
    background: linear-gradient(to bottom, #fff 0%, #fff 100%);
  }
  .maskEditor_sidePanelToggleCheckbox:checked + .maskEditor_sidePanelToggleSwitch {
    background: var(--p-button-text-primary-color);
  }
  .maskEditor_sidePanelToggleCheckbox:checked + .maskEditor_toggle_bg_dark:before {
    background: var(--p-surface-900);
  }
  .maskEditor_sidePanelToggleCheckbox:checked + .maskEditor_toggle_bg_light:before {
    background: var(--comfy-menu-bg);
  }
  .maskEditor_sidePanelToggleCheckbox:checked + .maskEditor_sidePanelToggleSwitch:before {
    left: 20px;
  }

  .maskEditor_sidePanelToggleCheckbox {
    position: absolute;
    visibility: hidden;
  }

  .maskEditor_sidePanelDropdown_dark {
    border: 1px solid var(--p-form-field-border-color);
    background: var(--p-surface-900);
    height: 24px;
    padding-left: 5px;
    padding-right: 5px;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .maskEditor_sidePanelDropdown_dark option {
    background: var(--p-surface-900);
  }

  .maskEditor_sidePanelDropdown_dark:focus {
    outline: 1px solid var(--p-button-text-primary-color);
  }

  .maskEditor_sidePanelDropdown_dark option:hover {
    background: white;
  }
  .maskEditor_sidePanelDropdown_dark option:active {
    background: var(--p-highlight-background);
  }

  .maskEditor_sidePanelDropdown_light {
    border: 1px solid var(--p-form-field-border-color);
    background: var(--comfy-menu-bg);
    height: 24px;
    padding-left: 5px;
    padding-right: 5px;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .maskEditor_sidePanelDropdown_light option {
    background: var(--comfy-menu-bg);
  }

  .maskEditor_sidePanelDropdown_light:focus {
    outline: 1px solid var(--p-surface-300);
  }

  .maskEditor_sidePanelDropdown_light option:hover {
    background: white;
  }
  .maskEditor_sidePanelDropdown_light option:active {
    background: var(--p-surface-300);
  }

  .maskEditor_layerRow {
    height: 50px;
    width: 200px;
    border-radius: 10px;
  }

  .maskEditor_sidePanelLayerPreviewContainer {
    width: 40px;
    height: 30px;
  }

  .maskEditor_sidePanelLayerPreviewContainer > svg{
    width: 100%;
    height: 100%;
    object-fit: contain;
    fill: var(--p-surface-100);
  }

  #maskEditor_sidePanelImageLayerImage {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .maskEditor_sidePanelSubTitle {
    text-align: left;
    font-size: 12px;
    font-family: sans-serif;
    color: var(--descrip-text);
  }

  .maskEditor_containerDropdown {
    position: absolute;
    right: 0;
  }

  .maskEditor_sidePanelLayerCheckbox {
    margin-left: 15px;
  }

  .maskEditor_toolPanelZoomIndicator {
    width: 4rem;
    height: 4rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5px;
    color: var(--p-button-text-secondary-color);
    position: absolute;
    bottom: 0;
    transition: background-color 0.2s;
  }

  #maskEditor_toolPanelDimensionsText {
    font-size: 12px;
  }

  #maskEditor_topBarSaveButton {
    background: var(--p-primary-color) !important;
    color: var(--p-button-primary-color) !important;
  }

  #maskEditor_topBarSaveButton:hover {
    background: var(--p-primary-hover-color) !important;
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
  type: BrushShape
  size: number
  opacity: number
  hardness: number
  smoothingPrecision: number
}

const saveBrushToCache = debounce(function (key: string, brush: Brush): void {
  try {
    const brushString = JSON.stringify(brush)
    setStorageValue(key, brushString)
  } catch (error) {
    console.error('Failed to save brush to cache:', error)
  }
}, 300)

function loadBrushFromCache(key: string): Brush | null {
  try {
    const brushString = getStorageValue(key)
    if (brushString) {
      const brush = JSON.parse(brushString) as Brush
      console.log('Loaded brush from cache:', brush)
      return brush
    } else {
      console.log('No brush found in cache.')
      return null
    }
  } catch (error) {
    console.error('Failed to load brush from cache:', error)
    return null
  }
}

type Callback = (data?: any) => void

class MaskEditorDialog extends ComfyDialog {
  static instance: MaskEditorDialog | null = null

  //new
  private uiManager!: UIManager
  // @ts-expect-error unused variable
  private toolManager!: ToolManager
  // @ts-expect-error unused variable
  private panAndZoomManager!: PanAndZoomManager
  // @ts-expect-error unused variable
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
      this.uiManager.setSidebarImage()
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

    this.uiManager.setSaveButtonText(t('g.saving'))
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
      this.uiManager.setSaveButtonText(t('g.save'))
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
          this.uploadMask(filepath, formData, retries - 1)
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
  // @ts-expect-error unused variable
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

class BrushTool {
  brushSettings: Brush //this saves the current brush settings
  maskBlendMode: MaskBlendMode

  isDrawing: boolean = false
  isDrawingLine: boolean = false
  lineStartPoint: Point | null = null
  smoothingPrecision: number = 10
  smoothingCordsArray: Point[] = []
  smoothingLastDrawTime!: Date
  maskCtx: CanvasRenderingContext2D | null = null
  initialDraw: boolean = true

  brushStrokeCanvas: HTMLCanvasElement | null = null
  brushStrokeCtx: CanvasRenderingContext2D | null = null

  //brush adjustment
  isBrushAdjusting: boolean = false
  brushPreviewGradient: HTMLElement | null = null
  initialPoint: Point | null = null
  useDominantAxis: boolean = false
  brushAdjustmentSpeed: number = 1.0

  maskEditor: MaskEditorDialog
  messageBroker: MessageBroker

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.createListeners()
    this.addPullTopics()

    this.useDominantAxis = app.extensionManager.setting.get(
      'Comfy.MaskEditor.UseDominantAxis'
    )
    this.brushAdjustmentSpeed = app.extensionManager.setting.get(
      'Comfy.MaskEditor.BrushAdjustmentSpeed'
    )

    const cachedBrushSettings = loadBrushFromCache('maskeditor_brush_settings')
    if (cachedBrushSettings) {
      this.brushSettings = cachedBrushSettings
    } else {
      this.brushSettings = {
        type: BrushShape.Arc,
        size: 10,
        opacity: 0.7,
        hardness: 1,
        smoothingPrecision: 10
      }
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
    this.messageBroker.subscribe(
      'setBrushSmoothingPrecision',
      (precision: number) => this.setBrushSmoothingPrecision(precision)
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
      this.startDrawing(event)
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
      'brushSmoothingPrecision',
      async () => this.brushSettings.smoothingPrecision
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

  private async createBrushStrokeCanvas() {
    if (this.brushStrokeCanvas !== null) {
      return
    }

    const maskCanvas = await this.messageBroker.pull('maskCanvas')
    const canvas = document.createElement('canvas')
    canvas.width = maskCanvas.width
    canvas.height = maskCanvas.height

    this.brushStrokeCanvas = canvas
    this.brushStrokeCtx = canvas.getContext('2d')!
  }

  private async startDrawing(event: PointerEvent) {
    this.isDrawing = true
    let compositionOp: CompositionOperation
    let currentTool = await this.messageBroker.pull('currentTool')
    let coords = { x: event.offsetX, y: event.offsetY }
    let coords_canvas = await this.messageBroker.pull('screenToCanvas', coords)
    await this.createBrushStrokeCanvas()

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
      this.initialDraw = true
    }
  }

  private drawWithBetterSmoothing(point: Point) {
    // Add current point to the smoothing array
    if (!this.smoothingCordsArray) {
      this.smoothingCordsArray = []
    }
    const opacityConstant = 1 / (1 + Math.exp(3))
    const interpolatedOpacity =
      1 / (1 + Math.exp(-6 * (this.brushSettings.opacity - 0.5))) -
      opacityConstant

    this.smoothingCordsArray.push(point)

    // Keep a moving window of points for the spline
    const POINTS_NR = 5
    if (this.smoothingCordsArray.length < POINTS_NR) {
      return
    }

    // Calculate total length more efficiently
    let totalLength = 0
    const points = this.smoothingCordsArray
    const len = points.length - 1

    // Use local variables for better performance
    let dx, dy
    for (let i = 0; i < len; i++) {
      dx = points[i + 1].x - points[i].x
      dy = points[i + 1].y - points[i].y
      totalLength += Math.sqrt(dx * dx + dy * dy)
    }

    const distanceBetweenPoints =
      (this.brushSettings.size / this.brushSettings.smoothingPrecision) * 6
    const stepNr = Math.ceil(totalLength / distanceBetweenPoints)

    let interpolatedPoints = points

    if (stepNr > 0) {
      //this calculation needs to be improved
      interpolatedPoints = this.generateEquidistantPoints(
        this.smoothingCordsArray,
        distanceBetweenPoints // Distance between interpolated points
      )
    }

    if (!this.initialDraw) {
      // Remove the first 3 points from the array to avoid drawing the same points twice
      const spliceIndex = interpolatedPoints.findIndex(
        (point) =>
          point.x === this.smoothingCordsArray[2].x &&
          point.y === this.smoothingCordsArray[2].y
      )

      if (spliceIndex !== -1) {
        interpolatedPoints = interpolatedPoints.slice(spliceIndex + 1)
      }
    }

    // Draw all interpolated points
    for (const point of interpolatedPoints) {
      this.draw_shape(point, interpolatedOpacity)
    }

    if (!this.initialDraw) {
      // initially draw on all 5 points, then remove the first 3 points to go into 2 new, 3 old points cycle
      this.smoothingCordsArray = this.smoothingCordsArray.slice(2)
    } else {
      this.initialDraw = false
    }
  }

  private async drawLine(
    p1: Point,
    p2: Point,
    compositionOp: CompositionOperation
  ) {
    const brush_size = await this.messageBroker.pull('brushSize')
    const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    const steps = Math.ceil(
      distance / ((brush_size / this.brushSettings.smoothingPrecision) * 4)
    ) // Adjust for smoother lines
    const interpolatedOpacity =
      1 / (1 + Math.exp(-6 * (this.brushSettings.opacity - 0.5))) -
      1 / (1 + Math.exp(3))
    this.init_shape(compositionOp)

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = p1.x + (p2.x - p1.x) * t
      const y = p1.y + (p2.y - p1.y) * t
      const point = { x: x, y: y }
      this.draw_shape(point, interpolatedOpacity)
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
    const brushDeadZone = 5
    let coords_canvas = await this.messageBroker.pull('screenToCanvas', coords)

    const delta_x = coords_canvas.x - this.initialPoint!.x
    const delta_y = coords_canvas.y - this.initialPoint!.y

    const effectiveDeltaX = Math.abs(delta_x) < brushDeadZone ? 0 : delta_x
    const effectiveDeltaY = Math.abs(delta_y) < brushDeadZone ? 0 : delta_y

    // New dominant axis logic
    let finalDeltaX = effectiveDeltaX
    let finalDeltaY = effectiveDeltaY

    console.log(this.useDominantAxis)

    if (this.useDominantAxis) {
      // New setting flag
      const ratio = Math.abs(effectiveDeltaX) / Math.abs(effectiveDeltaY)
      const threshold = 2.0 // Configurable threshold

      if (ratio > threshold) {
        finalDeltaY = 0 // X is dominant
      } else if (ratio < 1 / threshold) {
        finalDeltaX = 0 // Y is dominant
      }
    }

    const cappedDeltaX = Math.max(-100, Math.min(100, finalDeltaX))
    const cappedDeltaY = Math.max(-100, Math.min(100, finalDeltaY))

    // Rest of the function remains the same
    const newSize = Math.max(
      1,
      Math.min(
        100,
        this.brushSettings.size! +
          (cappedDeltaX / 35) * this.brushAdjustmentSpeed
      )
    )

    const newHardness = Math.max(
      0,
      Math.min(
        1,
        this.brushSettings!.hardness -
          (cappedDeltaY / 4000) * this.brushAdjustmentSpeed
      )
    )

    this.brushSettings.size = newSize
    this.brushSettings.hardness = newHardness

    this.messageBroker.publish('updateBrushPreview')
  }

  //helper functions

  private async draw_shape(point: Point, overrideOpacity?: number) {
    const brushSettings: Brush = this.brushSettings
    const maskCtx = this.maskCtx || (await this.messageBroker.pull('maskCtx'))
    const brushType = await this.messageBroker.pull('brushType')
    const maskColor = await this.messageBroker.pull('getMaskColor')
    const size = brushSettings.size
    const sliderOpacity = brushSettings.opacity
    const opacity =
      overrideOpacity == undefined ? sliderOpacity : overrideOpacity
    const hardness = brushSettings.hardness

    const x = point.x
    const y = point.y

    // Extend the gradient radius beyond the brush size
    const extendedSize = size * (2 - hardness)

    let gradient = maskCtx.createRadialGradient(x, y, 0, x, y, extendedSize)

    const isErasing = maskCtx.globalCompositeOperation === 'destination-out'

    if (hardness === 1) {
      console.log(sliderOpacity, opacity)
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

  private generateEquidistantPoints(
    points: Point[],
    distance: number
  ): Point[] {
    const result: Point[] = []
    const cumulativeDistances: number[] = [0]

    // Calculate cumulative distances between points
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      const dist = Math.hypot(dx, dy)
      cumulativeDistances[i] = cumulativeDistances[i - 1] + dist
    }

    const totalLength = cumulativeDistances[cumulativeDistances.length - 1]
    const numPoints = Math.floor(totalLength / distance)

    for (let i = 0; i <= numPoints; i++) {
      const targetDistance = i * distance
      let idx = 0

      // Find the segment where the target distance falls
      while (
        idx < cumulativeDistances.length - 1 &&
        cumulativeDistances[idx + 1] < targetDistance
      ) {
        idx++
      }

      if (idx >= points.length - 1) {
        result.push(points[points.length - 1])
        continue
      }

      const d0 = cumulativeDistances[idx]
      const d1 = cumulativeDistances[idx + 1]
      const t = (targetDistance - d0) / (d1 - d0)

      const x = points[idx].x + t * (points[idx + 1].x - points[idx].x)
      const y = points[idx].y + t * (points[idx + 1].y - points[idx].y)

      result.push({ x, y })
    }

    return result
  }

  private setBrushSize(size: number) {
    this.brushSettings.size = size
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }

  private setBrushOpacity(opacity: number) {
    this.brushSettings.opacity = opacity
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }

  private setBrushHardness(hardness: number) {
    this.brushSettings.hardness = hardness
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }

  private setBrushType(type: BrushShape) {
    this.brushSettings.type = type
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }

  private setBrushSmoothingPrecision(precision: number) {
    this.brushSettings.smoothingPrecision = precision
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
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
  // @ts-expect-error unused variable
  private maskOpacitySlider!: HTMLInputElement
  private brushHardnessSlider!: HTMLInputElement
  private brushSizeSlider!: HTMLInputElement
  // @ts-expect-error unused variable
  private brushOpacitySlider!: HTMLInputElement
  private sidebarImage!: HTMLImageElement
  private saveButton!: HTMLButtonElement
  private toolPanel!: HTMLDivElement
  // @ts-expect-error unused variable
  private sidePanel!: HTMLDivElement
  private pointerZone!: HTMLDivElement
  private canvasBackground!: HTMLDivElement
  private canvasContainer!: HTMLDivElement
  private image!: HTMLImageElement
  private imageURL!: URL
  private darkMode: boolean = true

  private maskEditor: MaskEditorDialog
  private messageBroker: MessageBroker

  private mask_opacity: number = 1.0
  private maskBlendMode: MaskBlendMode = MaskBlendMode.Black

  private zoomTextHTML!: HTMLSpanElement
  private dimensionsTextHTML!: HTMLSpanElement

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

    this.messageBroker.subscribe('setZoomText', (text: string) =>
      this.setZoomText(text)
    )
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
    this.detectLightMode()
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
    this.saveButton.innerText = t('g.save')
    this.saveButton.disabled = false

    await this.setImages(this.imgCanvas) //probably change method to initImageCanvas
  }

  private async createSidePanel() {
    const side_panel = this.createContainer(true)
    side_panel.id = 'maskEditor_sidePanel'

    const brush_settings = await this.createBrushSettings()
    brush_settings.id = 'maskEditor_brushSettings'
    this.brushSettingsHTML = brush_settings

    const paint_bucket_settings = await this.createPaintBucketSettings()
    paint_bucket_settings.id = 'maskEditor_paintBucketSettings'
    this.paintBucketSettingsHTML = paint_bucket_settings

    const color_select_settings = await this.createColorSelectSettings()
    color_select_settings.id = 'maskEditor_colorSelectSettings'
    this.colorSelectSettingsHTML = color_select_settings

    const image_layer_settings = await this.createImageLayerSettings()

    const separator = this.createSeparator()

    side_panel.appendChild(brush_settings)
    side_panel.appendChild(paint_bucket_settings)
    side_panel.appendChild(color_select_settings)
    side_panel.appendChild(separator)
    side_panel.appendChild(image_layer_settings)

    return side_panel
  }

  private async createBrushSettings() {
    const shapeColor = this.darkMode
      ? 'maskEditor_brushShape_dark'
      : 'maskEditor_brushShape_light'
    const brush_settings_container = this.createContainer(true)

    const brush_settings_title = this.createHeadline(
      t('maskEditor.Brush Settings')
    )

    const brush_shape_outer_container = this.createContainer(true)

    const brush_shape_title = this.createContainerTitle(
      t('maskEditor.Brush Shape')
    )

    const brush_shape_container = this.createContainer(false)

    const accentColor = this.darkMode
      ? 'maskEditor_accent_bg_dark'
      : 'maskEditor_accent_bg_light'

    brush_shape_container.classList.add(accentColor)
    brush_shape_container.classList.add('maskEditor_layerRow')

    const circle_shape = document.createElement('div')
    circle_shape.id = 'maskEditor_sidePanelBrushShapeCircle'
    circle_shape.classList.add(shapeColor)
    circle_shape.addEventListener('click', () => {
      this.messageBroker.publish('setBrushShape', BrushShape.Arc)
      this.setBrushBorderRadius()
      circle_shape.style.background = 'var(--p-button-text-primary-color)'
      square_shape.style.background = ''
    })

    const square_shape = document.createElement('div')
    square_shape.id = 'maskEditor_sidePanelBrushShapeSquare'
    square_shape.classList.add(shapeColor)
    square_shape.addEventListener('click', () => {
      this.messageBroker.publish('setBrushShape', BrushShape.Rect)
      this.setBrushBorderRadius()
      square_shape.style.background = 'var(--p-button-text-primary-color)'
      circle_shape.style.background = ''
    })

    if (
      (await this.messageBroker.pull('brushSettings')).type === BrushShape.Arc
    ) {
      circle_shape.style.background = 'var(--p-button-text-primary-color)'
      square_shape.style.background = ''
    } else {
      circle_shape.style.background = ''
      square_shape.style.background = 'var(--p-button-text-primary-color)'
    }

    brush_shape_container.appendChild(circle_shape)
    brush_shape_container.appendChild(square_shape)

    brush_shape_outer_container.appendChild(brush_shape_title)
    brush_shape_outer_container.appendChild(brush_shape_container)

    const thicknesSliderObj = this.createSlider(
      t('maskEditor.Thickness'),
      1,
      100,
      1,
      (await this.messageBroker.pull('brushSettings')).size,
      (_, value) => {
        this.messageBroker.publish('setBrushSize', parseInt(value))
        this.updateBrushPreview()
      }
    )
    this.brushSizeSlider = thicknesSliderObj.slider

    const opacitySliderObj = this.createSlider(
      t('maskEditor.Opacity'),
      0,
      1,
      0.01,
      (await this.messageBroker.pull('brushSettings')).opacity,
      (_, value) => {
        this.messageBroker.publish('setBrushOpacity', parseFloat(value))
        this.updateBrushPreview()
      }
    )
    this.brushOpacitySlider = opacitySliderObj.slider

    const hardnessSliderObj = this.createSlider(
      t('maskEditor.Hardness'),
      0,
      1,
      0.01,
      (await this.messageBroker.pull('brushSettings')).hardness,
      (_, value) => {
        this.messageBroker.publish('setBrushHardness', parseFloat(value))
        this.updateBrushPreview()
      }
    )
    this.brushHardnessSlider = hardnessSliderObj.slider

    const brushSmoothingPrecisionSliderObj = this.createSlider(
      t('maskEditor.Smoothing Precision'),
      1,
      100,
      1,
      (await this.messageBroker.pull('brushSettings')).smoothingPrecision,
      (_, value) => {
        this.messageBroker.publish(
          'setBrushSmoothingPrecision',
          parseInt(value)
        )
      }
    )

    const resetBrushSettingsButton = document.createElement('button')
    resetBrushSettingsButton.id = 'resetBrushSettingsButton'
    resetBrushSettingsButton.innerText = t('maskEditor.Reset to Default')

    resetBrushSettingsButton.addEventListener('click', () => {
      this.messageBroker.publish('setBrushShape', BrushShape.Arc)
      this.messageBroker.publish('setBrushSize', 10)
      this.messageBroker.publish('setBrushOpacity', 0.7)
      this.messageBroker.publish('setBrushHardness', 1)
      this.messageBroker.publish('setBrushSmoothingPrecision', 10)

      circle_shape.style.background = 'var(--p-button-text-primary-color)'
      square_shape.style.background = ''

      thicknesSliderObj.slider.value = '10'
      opacitySliderObj.slider.value = '0.7'
      hardnessSliderObj.slider.value = '1'
      brushSmoothingPrecisionSliderObj.slider.value = '10'

      this.setBrushBorderRadius()
      this.updateBrushPreview()
    })

    brush_settings_container.appendChild(brush_settings_title)
    brush_settings_container.appendChild(resetBrushSettingsButton)
    brush_settings_container.appendChild(brush_shape_outer_container)
    brush_settings_container.appendChild(thicknesSliderObj.container)
    brush_settings_container.appendChild(opacitySliderObj.container)
    brush_settings_container.appendChild(hardnessSliderObj.container)
    brush_settings_container.appendChild(
      brushSmoothingPrecisionSliderObj.container
    )

    return brush_settings_container
  }

  private async createPaintBucketSettings() {
    const paint_bucket_settings_container = this.createContainer(true)

    const paint_bucket_settings_title = this.createHeadline(
      t('maskEditor.Paint Bucket Settings')
    )

    const tolerance = await this.messageBroker.pull('getTolerance')
    const paintBucketToleranceSliderObj = this.createSlider(
      t('maskEditor.Tolerance'),
      0,
      255,
      1,
      tolerance,
      (_, value) => {
        this.messageBroker.publish('setPaintBucketTolerance', parseInt(value))
      }
    )

    // Add new slider for fill opacity
    const fillOpacity = (await this.messageBroker.pull('getFillOpacity')) || 100
    const fillOpacitySliderObj = this.createSlider(
      t('maskEditor.Fill Opacity'),
      0,
      100,
      1,
      fillOpacity,
      (_, value) => {
        this.messageBroker.publish('setFillOpacity', parseInt(value))
      }
    )

    paint_bucket_settings_container.appendChild(paint_bucket_settings_title)
    paint_bucket_settings_container.appendChild(
      paintBucketToleranceSliderObj.container
    )
    // Add the new opacity slider to the UI
    paint_bucket_settings_container.appendChild(fillOpacitySliderObj.container)

    return paint_bucket_settings_container
  }

  private async createColorSelectSettings() {
    const color_select_settings_container = this.createContainer(true)

    const color_select_settings_title = this.createHeadline(
      t('maskEditor.Color Select Settings')
    )

    var tolerance = await this.messageBroker.pull('getTolerance')
    const colorSelectToleranceSliderObj = this.createSlider(
      t('maskEditor.Tolerance'),
      0,
      255,
      1,
      tolerance,
      (_, value) => {
        this.messageBroker.publish('setColorSelectTolerance', parseInt(value))
      }
    )

    // Add new slider for selection opacity
    const selectionOpacitySliderObj = this.createSlider(
      t('maskEditor.Selection Opacity'),
      0,
      100,
      1,
      100, // Default to 100%
      (_, value) => {
        this.messageBroker.publish('setSelectionOpacity', parseInt(value))
      }
    )

    const livePreviewToggle = this.createToggle(
      t('maskEditor.Live Preview'),
      (_, value) => {
        this.messageBroker.publish('setLivePreview', value)
      }
    )

    const wholeImageToggle = this.createToggle(
      t('maskEditor.Apply to Whole Image'),
      (_, value) => {
        this.messageBroker.publish('setWholeImage', value)
      }
    )

    const methodOptions = Object.values(ColorComparisonMethod)
    const methodSelect = this.createDropdown(
      t('maskEditor.Method'),
      methodOptions,
      (_, value) => {
        this.messageBroker.publish('setColorComparisonMethod', value)
      }
    )

    const maskBoundaryToggle = this.createToggle(
      t('maskEditor.Stop at mask'),
      (_, value) => {
        this.messageBroker.publish('setMaskBoundary', value)
      }
    )

    const maskToleranceSliderObj = this.createSlider(
      t('maskEditor.Mask Tolerance'),
      0,
      255,
      1,
      0,
      (_, value) => {
        this.messageBroker.publish('setMaskTolerance', parseInt(value))
      }
    )

    color_select_settings_container.appendChild(color_select_settings_title)
    color_select_settings_container.appendChild(
      colorSelectToleranceSliderObj.container
    )
    // Add the new opacity slider to the UI
    color_select_settings_container.appendChild(
      selectionOpacitySliderObj.container
    )
    color_select_settings_container.appendChild(livePreviewToggle)
    color_select_settings_container.appendChild(wholeImageToggle)
    color_select_settings_container.appendChild(methodSelect)
    color_select_settings_container.appendChild(maskBoundaryToggle)
    color_select_settings_container.appendChild(
      maskToleranceSliderObj.container
    )

    return color_select_settings_container
  }

  private async createImageLayerSettings() {
    const accentColor = this.darkMode
      ? 'maskEditor_accent_bg_dark'
      : 'maskEditor_accent_bg_light'

    const image_layer_settings_container = this.createContainer(true)

    const image_layer_settings_title = this.createHeadline(
      t('maskEditor.Layers')
    )

    const mask_layer_title = this.createContainerTitle(
      t('maskEditor.Mask Layer')
    )

    const mask_layer_container = this.createContainer(false)
    mask_layer_container.classList.add(accentColor)
    mask_layer_container.classList.add('maskEditor_layerRow')

    const mask_layer_visibility_checkbox = document.createElement('input')
    mask_layer_visibility_checkbox.setAttribute('type', 'checkbox')
    mask_layer_visibility_checkbox.checked = true
    mask_layer_visibility_checkbox.classList.add(
      'maskEditor_sidePanelLayerCheckbox'
    )
    mask_layer_visibility_checkbox.addEventListener('change', (event) => {
      if (!(event.target as HTMLInputElement)!.checked) {
        this.maskCanvas.style.opacity = '0'
      } else {
        this.maskCanvas.style.opacity = String(this.mask_opacity) //change name
      }
    })

    var mask_layer_image_container = document.createElement('div')
    mask_layer_image_container.classList.add(
      'maskEditor_sidePanelLayerPreviewContainer'
    )
    mask_layer_image_container.innerHTML =
      '<svg viewBox="0 0 20 20" style="">   <path class="cls-1" d="M1.31,5.32v9.36c0,.55.45,1,1,1h15.38c.55,0,1-.45,1-1V5.32c0-.55-.45-1-1-1H2.31c-.55,0-1,.45-1,1ZM11.19,13.44c-2.91.94-5.57-1.72-4.63-4.63.34-1.05,1.19-1.9,2.24-2.24,2.91-.94,5.57,1.72,4.63,4.63-.34,1.05-1.19,1.9-2.24,2.24Z"/> </svg>'

    var blending_options = ['black', 'white', 'negative']

    const sidePanelDropdownAccent = this.darkMode
      ? 'maskEditor_sidePanelDropdown_dark'
      : 'maskEditor_sidePanelDropdown_light'

    var mask_layer_dropdown = document.createElement('select')
    mask_layer_dropdown.classList.add(sidePanelDropdownAccent)
    mask_layer_dropdown.classList.add(sidePanelDropdownAccent)
    blending_options.forEach((option) => {
      var option_element = document.createElement('option')
      option_element.value = option
      option_element.innerText = option
      mask_layer_dropdown.appendChild(option_element)

      if (option == this.maskBlendMode) {
        option_element.selected = true
      }
    })

    mask_layer_dropdown.addEventListener('change', (event) => {
      const selectedValue = (event.target as HTMLSelectElement)
        .value as MaskBlendMode
      this.maskBlendMode = selectedValue
      this.updateMaskColor()
    })

    mask_layer_container.appendChild(mask_layer_visibility_checkbox)
    mask_layer_container.appendChild(mask_layer_image_container)
    mask_layer_container.appendChild(mask_layer_dropdown)

    const mask_layer_opacity_sliderObj = this.createSlider(
      t('maskEditor.Mask Opacity'),
      0.0,
      1.0,
      0.01,
      this.mask_opacity,
      (_, value) => {
        this.mask_opacity = parseFloat(value)
        this.maskCanvas.style.opacity = String(this.mask_opacity)

        if (this.mask_opacity == 0) {
          mask_layer_visibility_checkbox.checked = false
        } else {
          mask_layer_visibility_checkbox.checked = true
        }
      }
    )
    this.maskOpacitySlider = mask_layer_opacity_sliderObj.slider

    const image_layer_title = this.createContainerTitle(
      t('maskEditor.Image Layer')
    )

    const image_layer_container = this.createContainer(false)
    image_layer_container.classList.add(accentColor)
    image_layer_container.classList.add('maskEditor_layerRow')

    const image_layer_visibility_checkbox = document.createElement('input')
    image_layer_visibility_checkbox.setAttribute('type', 'checkbox')
    image_layer_visibility_checkbox.classList.add(
      'maskEditor_sidePanelLayerCheckbox'
    )
    image_layer_visibility_checkbox.checked = true
    image_layer_visibility_checkbox.addEventListener('change', (event) => {
      if (!(event.target as HTMLInputElement)!.checked) {
        this.imgCanvas.style.opacity = '0'
      } else {
        this.imgCanvas.style.opacity = '1'
      }
    })

    const image_layer_image_container = document.createElement('div')
    image_layer_image_container.classList.add(
      'maskEditor_sidePanelLayerPreviewContainer'
    )

    const image_layer_image = document.createElement('img')
    image_layer_image.id = 'maskEditor_sidePanelImageLayerImage'
    image_layer_image.src =
      ComfyApp.clipspace?.imgs?.[ComfyApp.clipspace?.selectedIndex ?? 0]?.src ??
      ''
    this.sidebarImage = image_layer_image

    image_layer_image_container.appendChild(image_layer_image)

    image_layer_container.appendChild(image_layer_visibility_checkbox)
    image_layer_container.appendChild(image_layer_image_container)

    image_layer_settings_container.appendChild(image_layer_settings_title)
    image_layer_settings_container.appendChild(mask_layer_title)
    image_layer_settings_container.appendChild(mask_layer_container)
    image_layer_settings_container.appendChild(
      mask_layer_opacity_sliderObj.container
    )
    image_layer_settings_container.appendChild(image_layer_title)
    image_layer_settings_container.appendChild(image_layer_container)

    return image_layer_settings_container
  }

  private createHeadline(title: string) {
    var headline = document.createElement('h3')
    headline.classList.add('maskEditor_sidePanelTitle')
    headline.innerText = title

    return headline
  }

  private createContainer(flexDirection: boolean) {
    var container = document.createElement('div')
    if (flexDirection) {
      container.classList.add('maskEditor_sidePanelContainerColumn')
    } else {
      container.classList.add('maskEditor_sidePanelContainerRow')
    }

    return container
  }

  private createContainerTitle(title: string) {
    var container_title = document.createElement('span')
    container_title.classList.add('maskEditor_sidePanelSubTitle')
    container_title.innerText = title

    return container_title
  }

  private createSlider(
    title: string,
    min: number,
    max: number,
    step: number,
    value: number,
    callback: (event: Event, value: string) => void
  ) {
    var slider_container = this.createContainer(true)
    var slider_title = this.createContainerTitle(title)

    var slider = document.createElement('input')
    slider.classList.add('maskEditor_sidePanelBrushRange')
    slider.setAttribute('type', 'range')
    slider.setAttribute('min', String(min))
    slider.setAttribute('max', String(max))
    slider.setAttribute('step', String(step))
    slider.setAttribute('value', String(value))
    slider.addEventListener('input', (event) => {
      callback(event, (event.target as HTMLInputElement).value)
    })
    slider_container.appendChild(slider_title)
    slider_container.appendChild(slider)

    return { container: slider_container, slider: slider }
  }

  private createToggle(
    title: string,
    callback: (event: Event, value: boolean) => void
  ) {
    var outer_Container = this.createContainer(false)
    var toggle_title = this.createContainerTitle(title)

    var toggle_container = document.createElement('label')
    toggle_container.classList.add('maskEditor_sidePanelToggleContainer')

    var toggle_checkbox = document.createElement('input')
    toggle_checkbox.setAttribute('type', 'checkbox')
    toggle_checkbox.classList.add('maskEditor_sidePanelToggleCheckbox')
    toggle_checkbox.addEventListener('change', (event) => {
      callback(event, (event.target as HTMLInputElement).checked)
    })

    var toggleAccentColor = this.darkMode
      ? 'maskEditor_toggle_bg_dark'
      : 'maskEditor_toggle_bg_light'

    var toggle_switch = document.createElement('div')
    toggle_switch.classList.add('maskEditor_sidePanelToggleSwitch')
    toggle_switch.classList.add(toggleAccentColor)

    toggle_container.appendChild(toggle_checkbox)
    toggle_container.appendChild(toggle_switch)

    outer_Container.appendChild(toggle_title)
    outer_Container.appendChild(toggle_container)

    return outer_Container
  }

  private createDropdown(
    title: string,
    options: string[],
    callback: (event: Event, value: string) => void
  ) {
    const sidePanelDropdownAccent = this.darkMode
      ? 'maskEditor_sidePanelDropdown_dark'
      : 'maskEditor_sidePanelDropdown_light'
    var dropdown_container = this.createContainer(false)
    var dropdown_title = this.createContainerTitle(title)

    var dropdown = document.createElement('select')
    dropdown.classList.add(sidePanelDropdownAccent)
    dropdown.classList.add('maskEditor_containerDropdown')

    options.forEach((option) => {
      var option_element = document.createElement('option')
      option_element.value = option
      option_element.innerText = option
      dropdown.appendChild(option_element)
    })

    dropdown.addEventListener('change', (event) => {
      callback(event, (event.target as HTMLSelectElement).value)
    })

    dropdown_container.appendChild(dropdown_title)
    dropdown_container.appendChild(dropdown)

    return dropdown_container
  }

  private createSeparator() {
    var separator = document.createElement('div')
    separator.classList.add('maskEditor_sidePanelSeparator')

    return separator
  }

  //----------------

  private async createTopBar() {
    const buttonAccentColor = this.darkMode
      ? 'maskEditor_topPanelButton_dark'
      : 'maskEditor_topPanelButton_light'

    const iconButtonAccentColor = this.darkMode
      ? 'maskEditor_topPanelIconButton_dark'
      : 'maskEditor_topPanelIconButton_light'

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
    top_bar_undo_button.classList.add(iconButtonAccentColor)
    top_bar_undo_button.innerHTML =
      '<svg viewBox="0 0 15 15"><path d="M8.77,12.18c-.25,0-.46-.2-.46-.46s.2-.46.46-.46c1.47,0,2.67-1.2,2.67-2.67,0-1.57-1.34-2.67-3.26-2.67h-3.98l1.43,1.43c.18.18.18.47,0,.64-.18.18-.47.18-.64,0l-2.21-2.21c-.18-.18-.18-.47,0-.64l2.21-2.21c.18-.18.47-.18.64,0,.18.18.18.47,0,.64l-1.43,1.43h3.98c2.45,0,4.17,1.47,4.17,3.58,0,1.97-1.61,3.58-3.58,3.58Z"></path> </svg>'

    top_bar_undo_button.addEventListener('click', () => {
      this.messageBroker.publish('undo')
    })

    var top_bar_redo_button = document.createElement('div')
    top_bar_redo_button.id = 'maskEditor_topBarRedoButton'
    top_bar_redo_button.classList.add(iconButtonAccentColor)
    top_bar_redo_button.innerHTML =
      '<svg viewBox="0 0 15 15"> <path class="cls-1" d="M6.23,12.18c-1.97,0-3.58-1.61-3.58-3.58,0-2.11,1.71-3.58,4.17-3.58h3.98l-1.43-1.43c-.18-.18-.18-.47,0-.64.18-.18.46-.18.64,0l2.21,2.21c.09.09.13.2.13.32s-.05.24-.13.32l-2.21,2.21c-.18.18-.47.18-.64,0-.18-.18-.18-.47,0-.64l1.43-1.43h-3.98c-1.92,0-3.26,1.1-3.26,2.67,0,1.47,1.2,2.67,2.67,2.67.25,0,.46.2.46.46s-.2.46-.46.46Z"/></svg>'

    top_bar_redo_button.addEventListener('click', () => {
      this.messageBroker.publish('redo')
    })

    var top_bar_invert_button = document.createElement('button')
    top_bar_invert_button.id = 'maskEditor_topBarInvertButton'
    top_bar_invert_button.classList.add(buttonAccentColor)
    top_bar_invert_button.innerText = t('maskEditor.Invert')
    top_bar_invert_button.addEventListener('click', () => {
      this.messageBroker.publish('invert')
    })

    var top_bar_clear_button = document.createElement('button')
    top_bar_clear_button.id = 'maskEditor_topBarClearButton'
    top_bar_clear_button.classList.add(buttonAccentColor)
    top_bar_clear_button.innerText = t('maskEditor.Clear')

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
    top_bar_save_button.classList.add(buttonAccentColor)
    top_bar_save_button.innerText = t('g.save')
    this.saveButton = top_bar_save_button

    top_bar_save_button.addEventListener('click', () => {
      this.maskEditor.save()
    })

    var top_bar_cancel_button = document.createElement('button')
    top_bar_cancel_button.id = 'maskEditor_topBarCancelButton'
    top_bar_cancel_button.classList.add(buttonAccentColor)
    top_bar_cancel_button.innerText = t('g.cancel')

    top_bar_cancel_button.addEventListener('click', () => {
      this.maskEditor.close()
    })

    top_bar_shortcuts_container.appendChild(top_bar_undo_button)
    top_bar_shortcuts_container.appendChild(top_bar_redo_button)
    top_bar_shortcuts_container.appendChild(top_bar_invert_button)
    top_bar_shortcuts_container.appendChild(top_bar_clear_button)
    top_bar_shortcuts_container.appendChild(top_bar_save_button)
    top_bar_shortcuts_container.appendChild(top_bar_cancel_button)

    top_bar.appendChild(top_bar_title_container)
    top_bar.appendChild(top_bar_shortcuts_container)

    return top_bar
  }

  private createToolPanel() {
    var tool_panel = document.createElement('div')
    tool_panel.id = 'maskEditor_toolPanel'
    this.toolPanel = tool_panel
    var toolPanelHoverAccent = this.darkMode
      ? 'maskEditor_toolPanelContainerDark'
      : 'maskEditor_toolPanelContainerLight'

    var toolElements: HTMLElement[] = []

    //brush tool

    var toolPanel_brushToolContainer = document.createElement('div')
    toolPanel_brushToolContainer.classList.add('maskEditor_toolPanelContainer')
    toolPanel_brushToolContainer.classList.add(
      'maskEditor_toolPanelContainerSelected'
    )
    toolPanel_brushToolContainer.classList.add(toolPanelHoverAccent)
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
    toolPanel_eraserToolContainer.classList.add(toolPanelHoverAccent)
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
    toolPanel_paintBucketToolContainer.classList.add(toolPanelHoverAccent)
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
    toolPanel_colorSelectToolContainer.classList.add(toolPanelHoverAccent)
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

    //zoom indicator
    var toolPanel_zoomIndicator = document.createElement('div')
    toolPanel_zoomIndicator.classList.add('maskEditor_toolPanelZoomIndicator')
    toolPanel_zoomIndicator.classList.add(toolPanelHoverAccent)

    var toolPanel_zoomText = document.createElement('span')
    toolPanel_zoomText.id = 'maskEditor_toolPanelZoomText'
    toolPanel_zoomText.innerText = '100%'
    this.zoomTextHTML = toolPanel_zoomText

    var toolPanel_DimensionsText = document.createElement('span')
    toolPanel_DimensionsText.id = 'maskEditor_toolPanelDimensionsText'
    toolPanel_DimensionsText.innerText = ' '
    this.dimensionsTextHTML = toolPanel_DimensionsText

    toolPanel_zoomIndicator.appendChild(toolPanel_zoomText)
    toolPanel_zoomIndicator.appendChild(toolPanel_DimensionsText)

    toolPanel_zoomIndicator.addEventListener('click', () => {
      this.messageBroker.publish('resetZoom')
    })

    tool_panel.appendChild(toolPanel_brushToolContainer)
    tool_panel.appendChild(toolPanel_eraserToolContainer)
    tool_panel.appendChild(toolPanel_paintBucketToolContainer)
    tool_panel.appendChild(toolPanel_colorSelectToolContainer)
    tool_panel.appendChild(toolPanel_zoomIndicator)

    return tool_panel
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

    pointer_zone.addEventListener('pointerleave', () => {
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

    pointer_zone.addEventListener('pointerenter', async () => {
      this.updateCursor()
    })

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
    await this.messageBroker.pull('brushSettings')
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
    this.imageURL = rgb_url
    console.log(rgb_url)
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

    this.dimensionsTextHTML.innerText = `${this.image.width}x${this.image.height}`

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

  private detectLightMode() {
    this.darkMode = document.body.classList.contains('dark-theme')
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

  setSidebarImage() {
    this.sidebarImage.src = this.imageURL.href
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

  setZoomText(zoomText: string) {
    this.zoomTextHTML.innerText = zoomText
  }

  setDimensionsText(dimensionsText: string) {
    this.dimensionsTextHTML.innerText = dimensionsText
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
  interpolatedZoomRatio: number = 1
  pan_offset: Offset = { x: 0, y: 0 }

  mouseDownPoint: Point | null = null
  initialPan: Offset = { x: 0, y: 0 }

  canvasContainer: HTMLElement | null = null
  maskCanvas: HTMLCanvasElement | null = null
  rootElement: HTMLElement | null = null

  image: HTMLImageElement | null = null
  imageRootWidth: number = 0
  imageRootHeight: number = 0

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

    this.messageBroker.subscribe('resetZoom', async () => {
      if (this.interpolatedZoomRatio === 1) return
      await this.smoothResetView()
    })
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

    console.log(oldZoom, newZoom)
    // Calculate new pan position
    const scaleFactor = newZoom / oldZoom
    this.pan_offset.x += mouseX - mouseX * scaleFactor
    this.pan_offset.y += mouseY - mouseY * scaleFactor

    // Update pan and zoom immediately
    await this.invalidatePanZoom()

    const newImageWidth = maskCanvas.clientWidth

    const zoomRatio = newImageWidth / this.imageRootWidth

    this.interpolatedZoomRatio = zoomRatio

    this.messageBroker.publish('setZoomText', `${Math.round(zoomRatio * 100)}%`)

    // Update cursor position with new pan values
    this.updateCursorPosition(cursorPoint)

    // Update brush preview after pan/zoom is complete
    requestAnimationFrame(() => {
      this.messageBroker.publish('updateBrushPreview')
    })
  }

  private async smoothResetView(duration: number = 500) {
    // Store initial state
    const startZoom = this.zoom_ratio
    const startPan = { ...this.pan_offset }

    // Panel dimensions
    const sidePanelWidth = 220
    const toolPanelWidth = 64
    const topBarHeight = 44

    // Calculate available space
    const availableWidth =
      this.rootElement!.clientWidth - sidePanelWidth - toolPanelWidth
    const availableHeight = this.rootElement!.clientHeight - topBarHeight

    // Calculate target zoom
    const zoomRatioWidth = availableWidth / this.image!.width
    const zoomRatioHeight = availableHeight / this.image!.height
    const targetZoom = Math.min(zoomRatioWidth, zoomRatioHeight)

    // Calculate final dimensions
    const aspectRatio = this.image!.width / this.image!.height
    let finalWidth = 0
    let finalHeight = 0

    // Calculate target pan position
    const targetPan = { x: toolPanelWidth, y: topBarHeight }

    if (zoomRatioHeight > zoomRatioWidth) {
      finalWidth = availableWidth
      finalHeight = finalWidth / aspectRatio
      targetPan.y = (availableHeight - finalHeight) / 2 + topBarHeight
    } else {
      finalHeight = availableHeight
      finalWidth = finalHeight * aspectRatio
      targetPan.x = (availableWidth - finalWidth) / 2 + toolPanelWidth
    }

    const startTime = performance.now()
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Cubic easing out for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3)

      // Calculate intermediate zoom and pan values
      const currentZoom = startZoom + (targetZoom - startZoom) * eased

      this.zoom_ratio = currentZoom
      this.pan_offset.x = startPan.x + (targetPan.x - startPan.x) * eased
      this.pan_offset.y = startPan.y + (targetPan.y - startPan.y) * eased

      this.invalidatePanZoom()

      const interpolatedZoomRatio = startZoom + (1.0 - startZoom) * eased

      this.messageBroker.publish(
        'setZoomText',
        `${Math.round(interpolatedZoomRatio * 100)}%`
      )

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
    this.interpolatedZoomRatio = 1.0
  }

  async initializeCanvasPanZoom(
    image: HTMLImageElement,
    rootElement: HTMLElement
  ) {
    // Get side panel width
    let sidePanelWidth = 220
    const toolPanelWidth = 64
    let topBarHeight = 44

    this.rootElement = rootElement

    // Calculate available width accounting for both side panels
    let availableWidth =
      rootElement.clientWidth - sidePanelWidth - toolPanelWidth
    let availableHeight = rootElement.clientHeight - topBarHeight

    let zoomRatioWidth = availableWidth / image.width
    let zoomRatioHeight = availableHeight / image.height

    let aspectRatio = image.width / image.height

    let finalWidth = 0
    let finalHeight = 0

    let pan_offset: Offset = { x: toolPanelWidth, y: topBarHeight }

    if (zoomRatioHeight > zoomRatioWidth) {
      finalWidth = availableWidth
      finalHeight = finalWidth / aspectRatio
      pan_offset.y = (availableHeight - finalHeight) / 2 + topBarHeight
    } else {
      finalHeight = availableHeight
      finalWidth = finalHeight * aspectRatio
      pan_offset.x = (availableWidth - finalWidth) / 2 + toolPanelWidth
    }

    if (this.image === null) {
      this.image = image
    }

    this.imageRootWidth = finalWidth
    this.imageRootHeight = finalHeight

    this.zoom_ratio = Math.min(zoomRatioWidth, zoomRatioHeight)
    this.pan_offset = pan_offset

    await this.invalidatePanZoom()
  }

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
    this.messageBroker.pull('screenToCanvas', {
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
    this.createPushTopic('setBrushSmoothingPrecision')
    this.createPushTopic('setZoomText')
    this.createPushTopic('resetZoom')
    this.createPushTopic('invert')
    this.createPushTopic('setSelectionOpacity')
    this.createPushTopic('setFillOpacity')
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
  // @ts-expect-error unused variable
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
}

app.registerExtension({
  name: 'Comfy.MaskEditor',
  settings: [
    {
      id: 'Comfy.MaskEditor.UseNewEditor',
      category: ['Mask Editor', 'NewEditor'],
      name: 'Use new mask editor',
      tooltip: 'Switch to the new mask editor interface',
      type: 'boolean',
      defaultValue: true,
      experimental: true
    },
    {
      id: 'Comfy.MaskEditor.BrushAdjustmentSpeed',
      category: ['Mask Editor', 'BrushAdjustment', 'Sensitivity'],
      name: 'Brush adjustment speed multiplier',
      tooltip:
        'Controls how quickly the brush size and hardness change when adjusting. Higher values mean faster changes.',
      experimental: true,
      type: 'slider',
      attrs: {
        min: 0.1,
        max: 2.0,
        step: 0.1
      },
      defaultValue: 1.0,
      versionAdded: '1.0.0'
    },
    {
      id: 'Comfy.MaskEditor.UseDominantAxis',
      category: ['Mask Editor', 'BrushAdjustment', 'UseDominantAxis'],
      name: 'Lock brush adjustment to dominant axis',
      tooltip:
        'When enabled, brush adjustments will only affect size OR hardness based on which direction you move more',
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
