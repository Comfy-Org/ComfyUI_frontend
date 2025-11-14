import { t } from '@/i18n'
import { ComfyApp } from '@/scripts/app'
import type {
  MaskEditorDialog,
  ImageLayer,
  Point,
  ToolInternalSettings
} from '../types'
import { MessageBroker } from './MessageBroker'
import {
  BrushShape,
  ColorComparisonMethod,
  MaskBlendMode,
  Tools,
  allImageLayers,
  allTools
} from '../types'
import { iconsHtml } from '../constants'
import { imageLayerFilenamesIfApplicable, mkFileUrl, toRef } from '../utils'

export class UIManager {
  private rootElement: HTMLElement
  private brush!: HTMLDivElement
  private brushPreviewGradient!: HTMLDivElement
  private maskCtx!: CanvasRenderingContext2D
  private rgbCtx!: CanvasRenderingContext2D
  private imageCtx!: CanvasRenderingContext2D
  private maskCanvas!: HTMLCanvasElement
  private rgbCanvas!: HTMLCanvasElement
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
  private paint_image!: HTMLImageElement
  private imageURL!: URL
  private darkMode: boolean = true
  private maskLayerContainer: HTMLElement | null = null
  private paintLayerContainer: HTMLElement | null = null

  private createColorPicker(): HTMLInputElement {
    const colorPicker = document.createElement('input')
    colorPicker.type = 'color'
    colorPicker.id = 'maskEditor_colorPicker'
    colorPicker.value = '#FF0000' // Default color
    colorPicker.addEventListener('input', (event) => {
      const color = (event.target as HTMLInputElement).value
      this.messageBroker.publish('setRGBColor', color)
    })
    return colorPicker
  }

  private maskEditor: MaskEditorDialog
  private messageBroker: MessageBroker

  private mask_opacity: number = 0.8
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
    this.messageBroker.createPullTopic('rgbCtx', async () => this.rgbCtx)
    this.messageBroker.createPullTopic('rgbCanvas', async () => this.rgbCanvas)
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

    const rgbCanvas = document.createElement('canvas')
    rgbCanvas.id = 'rgbCanvas'

    const canvas_background = document.createElement('div')
    canvas_background.id = 'canvasBackground'

    canvasContainer.appendChild(imgCanvas)
    canvasContainer.appendChild(rgbCanvas)
    canvasContainer.appendChild(maskCanvas)
    canvasContainer.appendChild(canvas_background)

    // prepare content
    this.imgCanvas = imgCanvas!
    this.rgbCanvas = rgbCanvas!
    this.maskCanvas = maskCanvas!
    this.canvasContainer = canvasContainer!
    this.canvasBackground = canvas_background!

    let maskCtx = maskCanvas!.getContext('2d', { willReadFrequently: true })
    if (maskCtx) {
      this.maskCtx = maskCtx
    }
    let rgbCtx = rgbCanvas.getContext('2d', { willReadFrequently: true })
    if (rgbCtx) {
      this.rgbCtx = rgbCtx
    }
    let imgCtx = imgCanvas!.getContext('2d', { willReadFrequently: true })
    if (imgCtx) {
      this.imageCtx = imgCtx
    }
    this.setEventHandler()

    //remove styling and move to css file

    this.imgCanvas.style.position = 'absolute'
    this.rgbCanvas.style.position = 'absolute'
    this.maskCanvas.style.position = 'absolute'

    this.imgCanvas.style.top = '200'
    this.imgCanvas.style.left = '0'

    this.rgbCanvas.style.top = this.imgCanvas.style.top
    this.rgbCanvas.style.left = this.imgCanvas.style.left

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
    const sidePanelWrapper = this.createContainer(true)
    const side_panel = document.createElement('div')
    sidePanelWrapper.id = 'maskEditor_sidePanel'
    side_panel.id = 'maskEditor_sidePanelContent'

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
    sidePanelWrapper.appendChild(side_panel)

    return sidePanelWrapper
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
      this.messageBroker.publish('setBrushSize', 20)
      this.messageBroker.publish('setBrushOpacity', 1)
      this.messageBroker.publish('setBrushHardness', 1)
      this.messageBroker.publish('setBrushSmoothingPrecision', 60)

      circle_shape.style.background = 'var(--p-button-text-primary-color)'
      square_shape.style.background = ''

      thicknesSliderObj.slider.value = '20'
      opacitySliderObj.slider.value = '1'
      hardnessSliderObj.slider.value = '1'
      brushSmoothingPrecisionSliderObj.slider.value = '60'

      this.setBrushBorderRadius()
      this.updateBrushPreview()
    })

    brush_settings_container.appendChild(brush_settings_title)
    brush_settings_container.appendChild(resetBrushSettingsButton)
    brush_settings_container.appendChild(brush_shape_outer_container)

    // Create a new container for the color picker and its title
    const color_picker_container = this.createContainer(true)

    // Add the color picker title
    const colorPickerTitle = document.createElement('span')
    colorPickerTitle.innerText = 'Color Selector'
    colorPickerTitle.classList.add('maskEditor_sidePanelSubTitle') // Mimic brush shape title style
    color_picker_container.appendChild(colorPickerTitle)

    // Add the color picker
    const colorPicker = this.createColorPicker()
    color_picker_container.appendChild(colorPicker)

    // Add the color picker container to the main settings container
    brush_settings_container.appendChild(color_picker_container)

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

  activeLayer: 'mask' | 'rgb' = 'mask'
  layerButtons: Record<ImageLayer, HTMLButtonElement> = {
    mask: (() => {
      const btn = document.createElement('button')
      btn.style.fontSize = '12px'
      return btn
    })(),
    rgb: (() => {
      const btn = document.createElement('button')
      btn.style.fontSize = '12px'
      return btn
    })()
  }
  updateButtonsVisibility() {
    allImageLayers.forEach((layer) => {
      const button = this.layerButtons[layer]
      if (layer === this.activeLayer) {
        button.style.opacity = '0.5'
        button.disabled = true
      } else {
        button.style.opacity = '1'
        button.disabled = false
      }
    })
  }

  async updateLayerButtonsForTool() {
    const currentTool = await this.messageBroker.pull('currentTool')
    const isEraserTool = currentTool === Tools.Eraser

    // Show/hide buttons based on whether eraser tool is active
    Object.values(this.layerButtons).forEach((button) => {
      if (isEraserTool) {
        button.style.display = 'block'
      } else {
        button.style.display = 'none'
      }
    })
  }

  async setActiveLayer(layer: 'mask' | 'rgb') {
    this.messageBroker.publish('setActiveLayer', layer)
    this.activeLayer = layer
    this.updateButtonsVisibility()
    const currentTool = await this.messageBroker.pull('currentTool')
    const maskOnlyTools = [Tools.MaskPen, Tools.MaskBucket, Tools.MaskColorFill]
    if (maskOnlyTools.includes(currentTool) && layer === 'rgb') {
      this.setToolTo(Tools.PaintPen)
    }
    if (currentTool === Tools.PaintPen && layer === 'mask') {
      this.setToolTo(Tools.MaskPen)
    }
    this.updateActiveLayerHighlight()
  }

  updateActiveLayerHighlight() {
    // Remove blue border from all containers
    if (this.maskLayerContainer) {
      this.maskLayerContainer.style.border = 'none'
    }
    if (this.paintLayerContainer) {
      this.paintLayerContainer.style.border = 'none'
    }

    // Add blue border to active layer container
    if (this.activeLayer === 'mask' && this.maskLayerContainer) {
      this.maskLayerContainer.style.border = '2px solid #007acc'
    } else if (this.activeLayer === 'rgb' && this.paintLayerContainer) {
      this.paintLayerContainer.style.border = '2px solid #007acc'
    }
  }

  private async createImageLayerSettings() {
    const accentColor = this.darkMode
      ? 'maskEditor_accent_bg_dark'
      : 'maskEditor_accent_bg_light'

    const image_layer_settings_container = this.createContainer(true)

    const image_layer_settings_title = this.createHeadline(
      t('maskEditor.Layers')
    )

    // Add a new container for layer selection
    const layer_selection_container = this.createContainer(false)
    layer_selection_container.classList.add(accentColor)
    layer_selection_container.classList.add('maskEditor_layerRow')

    this.layerButtons.mask.innerText = 'Activate Layer'
    this.layerButtons.mask.addEventListener('click', async () => {
      this.setActiveLayer('mask')
    })

    this.layerButtons.rgb.innerText = 'Activate Layer'
    this.layerButtons.rgb.addEventListener('click', async () => {
      this.setActiveLayer('rgb')
    })

    // Initially hide the buttons (they'll be shown when eraser tool is selected)
    this.layerButtons.mask.style.display = 'none'
    this.layerButtons.rgb.style.display = 'none'

    this.setActiveLayer('mask')

    // 1. MASK LAYER CONTAINER
    const mask_layer_title = this.createContainerTitle('Mask Layer')
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
        this.maskCanvas.style.opacity = String(this.mask_opacity)
      }
    })

    var mask_layer_image_container = document.createElement('div')
    mask_layer_image_container.classList.add(
      'maskEditor_sidePanelLayerPreviewContainer'
    )
    mask_layer_image_container.innerHTML =
      '<svg viewBox="0 0 20 20" style="">   <path class="cls-1" d="M1.31,5.32v9.36c0,.55.45,1,1,1h15.38c.55,0,1-.45,1-1V5.32c0-.55-.45-1-1-1H2.31c-.55,0-1,.45-1,1ZM11.19,13.44c-2.91.94-5.57-1.72-4.63-4.63.34-1.05,1.19-1.9,2.24-2.24,2.91-.94,5.57,1.72,4.63,4.63-.34,1.05-1.19-1.9-2.24,2.24Z"/> </svg>'

    // Add checkbox, image container, and activate button to mask layer container
    mask_layer_container.appendChild(mask_layer_visibility_checkbox)
    mask_layer_container.appendChild(mask_layer_image_container)
    mask_layer_container.appendChild(this.layerButtons.mask)

    // Store reference to container for highlighting
    this.maskLayerContainer = mask_layer_container

    // 2. MASK BLENDING OPTIONS CONTAINER
    const mask_blending_options_title = this.createContainerTitle(
      'Mask Blending Options'
    )
    const mask_blending_options_container = this.createContainer(false)
    // mask_blending_options_container.classList.add(accentColor)
    mask_blending_options_container.classList.add('maskEditor_layerRow')
    mask_blending_options_container.style.marginTop = '-9px'
    mask_blending_options_container.style.marginBottom = '-6px'
    var blending_options = ['black', 'white', 'negative']
    const sidePanelDropdownAccent = this.darkMode
      ? 'maskEditor_sidePanelDropdown_dark'
      : 'maskEditor_sidePanelDropdown_light'

    var mask_layer_dropdown = document.createElement('select')
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

    // Center the dropdown in its container
    // mask_blending_options_container.style.display = 'flex'
    // mask_blending_options_container.style.justifyContent = 'center'
    mask_blending_options_container.appendChild(mask_layer_dropdown)

    // 3. MASK OPACITY SLIDER
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

    // 4. PAINT LAYER CONTAINER
    const paint_layer_title = this.createContainerTitle('Paint Layer')
    const paint_layer_container = this.createContainer(false)
    paint_layer_container.classList.add(accentColor)
    paint_layer_container.classList.add('maskEditor_layerRow')

    const paint_layer_checkbox = document.createElement('input')
    paint_layer_checkbox.setAttribute('type', 'checkbox')
    paint_layer_checkbox.classList.add('maskEditor_sidePanelLayerCheckbox')
    paint_layer_checkbox.checked = true
    paint_layer_checkbox.addEventListener('change', (event) => {
      if (!(event.target as HTMLInputElement)!.checked) {
        this.rgbCanvas.style.opacity = '0'
      } else {
        this.rgbCanvas.style.opacity = '1'
      }
    })

    const paint_layer_image_container = document.createElement('div')
    paint_layer_image_container.classList.add(
      'maskEditor_sidePanelLayerPreviewContainer'
    )
    paint_layer_image_container.innerHTML = `
      <svg viewBox="0 0 20 20">
        <path class="cls-1" d="M 17 6.965 c 0 0.235 -0.095 0.47 -0.275 0.655 l -6.51 6.52 c -0.045 0.035 -0.09 0.075 -0.135 0.11 c -0.035 -0.695 -0.605 -1.24 -1.305 -1.245 c 0.035 -0.06 0.08 -0.12 0.135 -0.17 l 6.52 -6.52 c 0.36 -0.36 0.945 -0.36 1.3 0 c 0.175 0.175 0.275 0.415 0.275 0.65 Z"/>
        <path class="cls-1" d="M 9.82 14.515 c 0 2.23 -3.23 1.59 -4.82 0 c 1.65 -0.235 2.375 -1.29 3.53 -1.29 c 0.715 0 1.29 0.58 1.29 1.29 Z"/>
      </svg>
    `

    paint_layer_container.appendChild(paint_layer_checkbox)
    paint_layer_container.appendChild(paint_layer_image_container)
    paint_layer_container.appendChild(this.layerButtons.rgb)

    // Store reference to container for highlighting
    this.paintLayerContainer = paint_layer_container

    // 5. BASE IMAGE LAYER CONTAINER
    const base_image_layer_title = this.createContainerTitle('Base Image Layer')
    const base_image_layer_container = this.createContainer(false)
    base_image_layer_container.classList.add(accentColor)
    base_image_layer_container.classList.add('maskEditor_layerRow')

    const base_image_layer_visibility_checkbox = document.createElement('input')
    base_image_layer_visibility_checkbox.setAttribute('type', 'checkbox')
    base_image_layer_visibility_checkbox.classList.add(
      'maskEditor_sidePanelLayerCheckbox'
    )
    base_image_layer_visibility_checkbox.checked = true
    base_image_layer_visibility_checkbox.addEventListener('change', (event) => {
      if (!(event.target as HTMLInputElement)!.checked) {
        this.imgCanvas.style.opacity = '0'
      } else {
        this.imgCanvas.style.opacity = '1'
      }
    })

    const base_image_layer_image_container = document.createElement('div')
    base_image_layer_image_container.classList.add(
      'maskEditor_sidePanelLayerPreviewContainer'
    )

    const base_image_layer_image = document.createElement('img')
    base_image_layer_image.id = 'maskEditor_sidePanelImageLayerImage'
    base_image_layer_image.src =
      ComfyApp.clipspace?.imgs?.[ComfyApp.clipspace?.selectedIndex ?? 0]?.src ??
      ''
    this.sidebarImage = base_image_layer_image

    base_image_layer_image_container.appendChild(base_image_layer_image)

    base_image_layer_container.appendChild(base_image_layer_visibility_checkbox)
    base_image_layer_container.appendChild(base_image_layer_image_container)

    // APPEND ALL CONTAINERS IN ORDER
    image_layer_settings_container.appendChild(image_layer_settings_title)
    image_layer_settings_container.appendChild(
      mask_layer_opacity_sliderObj.container
    )
    image_layer_settings_container.appendChild(mask_blending_options_title)
    image_layer_settings_container.appendChild(mask_blending_options_container)
    image_layer_settings_container.appendChild(mask_layer_title)
    image_layer_settings_container.appendChild(mask_layer_container)
    image_layer_settings_container.appendChild(paint_layer_title)
    image_layer_settings_container.appendChild(paint_layer_container)
    image_layer_settings_container.appendChild(base_image_layer_title)
    image_layer_settings_container.appendChild(base_image_layer_container)

    // Initialize the active layer highlighting
    this.updateActiveLayerHighlight()

    // Initialize button visibility based on current tool
    this.updateLayerButtonsForTool()

    return image_layer_settings_container
  }

  // Method to be called when tool changes
  async onToolChange() {
    await this.updateLayerButtonsForTool()
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
      this.rgbCtx.clearRect(0, 0, this.rgbCanvas.width, this.rgbCanvas.height)
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
      this.maskEditor.destroy()
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

  toolElements: HTMLElement[] = []
  toolSettings: Record<Tools, ToolInternalSettings> = {
    [Tools.MaskPen]: {
      container: document.createElement('div'),
      newActiveLayerOnSet: 'mask'
    },
    [Tools.Eraser]: {
      container: document.createElement('div')
    },
    [Tools.PaintPen]: {
      container: document.createElement('div'),
      newActiveLayerOnSet: 'rgb'
    },
    [Tools.MaskBucket]: {
      container: document.createElement('div'),
      cursor: "url('/cursor/paintBucket.png') 30 25, auto",
      newActiveLayerOnSet: 'mask'
    },
    [Tools.MaskColorFill]: {
      container: document.createElement('div'),
      cursor: "url('/cursor/colorSelect.png') 15 25, auto",
      newActiveLayerOnSet: 'mask'
    }
  }

  setToolTo(tool: Tools) {
    this.messageBroker.publish('setTool', tool)
    for (let toolElement of this.toolElements) {
      if (toolElement != this.toolSettings[tool].container) {
        toolElement.classList.remove('maskEditor_toolPanelContainerSelected')
      } else {
        toolElement.classList.add('maskEditor_toolPanelContainerSelected')
        this.brushSettingsHTML.style.display = 'flex'
        this.colorSelectSettingsHTML.style.display = 'none'
        this.paintBucketSettingsHTML.style.display = 'none'
      }
    }
    if (tool === Tools.MaskColorFill) {
      this.brushSettingsHTML.style.display = 'none'
      this.colorSelectSettingsHTML.style.display = 'flex'
      this.paintBucketSettingsHTML.style.display = 'none'
    } else if (tool === Tools.MaskBucket) {
      this.brushSettingsHTML.style.display = 'none'
      this.colorSelectSettingsHTML.style.display = 'none'
      this.paintBucketSettingsHTML.style.display = 'flex'
    } else {
      this.brushSettingsHTML.style.display = 'flex'
      this.colorSelectSettingsHTML.style.display = 'none'
      this.paintBucketSettingsHTML.style.display = 'none'
    }
    this.messageBroker.publish('setTool', tool)
    this.onToolChange()
    const newActiveLayer = this.toolSettings[tool].newActiveLayerOnSet
    if (newActiveLayer) {
      this.setActiveLayer(newActiveLayer)
    }
    const cursor = this.toolSettings[tool].cursor
    this.pointerZone.style.cursor = cursor ?? 'none'
    if (cursor) {
      this.brush.style.opacity = '0'
    }
  }

  private createToolPanel() {
    var tool_panel = document.createElement('div')
    tool_panel.id = 'maskEditor_toolPanel'
    this.toolPanel = tool_panel
    var toolPanelHoverAccent = this.darkMode
      ? 'maskEditor_toolPanelContainerDark'
      : 'maskEditor_toolPanelContainerLight'

    this.toolElements = []
    // mask pen tool
    const setupToolContainer = (tool: Tools) => {
      this.toolSettings[tool].container = document.createElement('div')
      this.toolSettings[tool].container.classList.add(
        'maskEditor_toolPanelContainer'
      )
      if (tool == Tools.MaskPen)
        this.toolSettings[tool].container.classList.add(
          'maskEditor_toolPanelContainerSelected'
        )
      this.toolSettings[tool].container.classList.add(toolPanelHoverAccent)
      this.toolSettings[tool].container.innerHTML = iconsHtml[tool]
      this.toolElements.push(this.toolSettings[tool].container)
      this.toolSettings[tool].container.addEventListener('click', () => {
        this.setToolTo(tool)
      })
      const activeIndicator = document.createElement('div')
      activeIndicator.classList.add('maskEditor_toolPanelIndicator')
      this.toolSettings[tool].container.appendChild(activeIndicator)
      tool_panel.appendChild(this.toolSettings[tool].container)
    }
    allTools.forEach(setupToolContainer)

    const setupZoomIndicatorContainer = () => {
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
      tool_panel.appendChild(toolPanel_zoomIndicator)
    }
    setupZoomIndicatorContainer()

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
    // Get the zoom ratio
    const zoomRatio = await this.messageBroker.pull('zoomRatio')

    // Get the bounding rectangles for both canvases
    const maskCanvasRect = this.maskCanvas.getBoundingClientRect()
    const rgbCanvasRect = this.rgbCanvas.getBoundingClientRect()

    // Check which canvas is currently being used for drawing
    const currentTool = await this.messageBroker.pull('currentTool')
    const isUsingRGBCanvas = currentTool === Tools.PaintPen

    // Use the appropriate canvas rect based on the current tool
    const canvasRect = isUsingRGBCanvas ? rgbCanvasRect : maskCanvasRect

    // Calculate the offset between pointer zone and canvas
    const offsetX = clientPoint.x - canvasRect.left + this.toolPanel.clientWidth
    const offsetY = clientPoint.y - canvasRect.top + 44 // 44 is the height of the top menu

    // Adjust for zoom ratio
    const x = offsetX / zoomRatio
    const y = offsetY / zoomRatio

    return { x: x, y: y }
  }

  private setEventHandler() {
    this.maskCanvas.addEventListener('contextmenu', (event: Event) => {
      event.preventDefault()
    })

    this.rgbCanvas.addEventListener('contextmenu', (event: Event) => {
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

    const rgbCanvas = this.rgbCanvas

    imgCtx!.clearRect(0, 0, this.imgCanvas.width, this.imgCanvas.height)
    maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height)

    const mainImageUrl =
      ComfyApp.clipspace?.imgs?.[ComfyApp.clipspace?.selectedIndex ?? 0]?.src

    // original image load
    if (!mainImageUrl) {
      throw new Error(
        'Unable to access image source - clipspace or image is null'
      )
    }

    const mainImageFilename =
      new URL(mainImageUrl).searchParams.get('filename') ?? undefined

    let combinedImageFilename: string | null | undefined
    if (
      ComfyApp.clipspace?.combinedIndex !== undefined &&
      ComfyApp.clipspace?.imgs &&
      ComfyApp.clipspace.combinedIndex < ComfyApp.clipspace.imgs.length &&
      ComfyApp.clipspace.imgs[ComfyApp.clipspace.combinedIndex]?.src
    ) {
      combinedImageFilename = new URL(
        ComfyApp.clipspace.imgs[ComfyApp.clipspace.combinedIndex].src
      ).searchParams.get('filename')
    } else {
      combinedImageFilename = undefined
    }

    const imageLayerFilenames =
      mainImageFilename !== undefined
        ? imageLayerFilenamesIfApplicable(
            combinedImageFilename ?? mainImageFilename
          )
        : undefined

    const inputUrls = {
      baseImagePlusMask: imageLayerFilenames?.maskedImage
        ? mkFileUrl({ ref: toRef(imageLayerFilenames.maskedImage) })
        : mainImageUrl,
      paintLayer: imageLayerFilenames?.paint
        ? mkFileUrl({ ref: toRef(imageLayerFilenames.paint) })
        : undefined
    }

    const alpha_url = new URL(inputUrls.baseImagePlusMask)
    alpha_url.searchParams.delete('channel')
    alpha_url.searchParams.delete('preview')
    alpha_url.searchParams.set('channel', 'a')
    let mask_image: HTMLImageElement = await this.loadImage(alpha_url)

    const rgb_url = new URL(inputUrls.baseImagePlusMask)
    this.imageURL = rgb_url
    rgb_url.searchParams.delete('channel')
    rgb_url.searchParams.set('channel', 'rgb')
    this.image = new Image()

    this.image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = rgb_url.toString()
    })

    if (inputUrls.paintLayer) {
      const paintURL = new URL(inputUrls.paintLayer)
      this.paint_image = new Image()
      this.paint_image = await new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = paintURL.toString()
        }
      )
    }

    maskCanvas.width = this.image.width
    maskCanvas.height = this.image.height

    rgbCanvas.width = this.image.width
    rgbCanvas.height = this.image.height

    this.dimensionsTextHTML.innerText = `${this.image.width}x${this.image.height}`

    await this.invalidateCanvas(this.image, mask_image, this.paint_image)
    this.messageBroker.publish('initZoomPan', [this.image, this.rootElement])
  }

  async invalidateCanvas(
    orig_image: HTMLImageElement,
    mask_image: HTMLImageElement,
    paint_image: HTMLImageElement
  ) {
    this.imgCanvas.width = orig_image.width
    this.imgCanvas.height = orig_image.height

    this.maskCanvas.width = orig_image.width
    this.maskCanvas.height = orig_image.height

    this.rgbCanvas.width = orig_image.width
    this.rgbCanvas.height = orig_image.height

    let imgCtx = this.imgCanvas.getContext('2d', { willReadFrequently: true })
    let maskCtx = this.maskCanvas.getContext('2d', {
      willReadFrequently: true
    })
    let rgbCtx = this.rgbCanvas.getContext('2d', {
      willReadFrequently: true
    })

    imgCtx!.drawImage(orig_image, 0, 0, orig_image.width, orig_image.height)
    if (paint_image) {
      rgbCtx!.drawImage(
        paint_image,
        0,
        0,
        paint_image.width,
        paint_image.height
      )
    }
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
      image.crossOrigin = 'anonymous'
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

    // Now that brush size is constant, preview is simple
    const brushRadius = brushSettings.size * zoom_ratio
    const previewSize = brushRadius * 2

    this.brushSizeSlider.value = String(brushSettings.size)
    this.brushHardnessSlider.value = String(hardness)

    brush.style.width = previewSize + 'px'
    brush.style.height = previewSize + 'px'
    brush.style.left = centerX - brushRadius + 'px'
    brush.style.top = centerY - brushRadius + 'px'

    if (hardness === 1) {
      this.brushPreviewGradient.style.background = 'rgba(255, 0, 0, 0.5)'
      return
    }

    // Simplified gradient - hardness controls where the fade starts
    const midStop = hardness * 100
    const outerStop = 100

    this.brushPreviewGradient.style.background = `
      radial-gradient(
        circle,
        rgba(255, 0, 0, 0.5) 0%,
        rgba(255, 0, 0, 0.25) ${midStop}%,
        rgba(255, 0, 0, 0) ${outerStop}%
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

  getRgbCanvas() {
    return this.rgbCanvas
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
    if (currentTool === Tools.MaskBucket) {
      this.pointerZone.style.cursor =
        "url('/cursor/paintBucket.png') 30 25, auto"
      this.setBrushOpacity(0)
    } else if (currentTool === Tools.MaskColorFill) {
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
