import { t } from '@/i18n'
import { api } from '../../../scripts/api'
import { ComfyApp } from '../../../scripts/app'
import { $el, ComfyDialog } from '../../../scripts/ui'
import { ClipspaceDialog } from '../clipspace'
import { imageLayerFilenamesByTimestamp } from './utils/maskEditorLayerFilenames'
import { CanvasHistory } from './CanvasHistory'
import { CompositionOperation } from './types'
import type { Ref } from './types'
import {
  UIManager,
  ToolManager,
  PanAndZoomManager,
  KeyboardManager,
  MessageBroker
} from './managers'
import { BrushTool, PaintBucketTool, ColorSelectTool } from './tools'
import {
  ensureImageFullyLoaded,
  removeImageRgbValuesAndInvertAlpha,
  createCanvasCopy,
  getCanvas2dContext,
  combineOriginalImageAndPaint,
  toRef,
  mkFileUrl,
  requestWithRetries,
  replaceClipspaceImages
} from './utils'

export class MaskEditorDialog extends ComfyDialog {
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
      if (MaskEditorDialog.instance) MaskEditorDialog.instance.destroy()
      MaskEditorDialog.instance = new MaskEditorDialog()
      MaskEditorDialog.instance.imageURL = currentSrc
    }
    return MaskEditorDialog.instance
  }

  override async show() {
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

  destroy() {
    this.isLayoutCreated = false
    this.isOpen = false
    this.canvasHistory.clearStates()
    this.keyboardManager.removeListeners()
    this.cleanup()
    this.close()
    MaskEditorDialog.instance = null
  }

  isOpened() {
    return this.isOpen
  }

  async save() {
    const imageCanvas = this.uiManager.getImgCanvas()
    const maskCanvas = this.uiManager.getMaskCanvas()
    const maskCanvasCtx = getCanvas2dContext(maskCanvas)
    const paintCanvas = this.uiManager.getRgbCanvas()
    const image = this.uiManager.getImage()

    try {
      await ensureImageFullyLoaded(maskCanvas.toDataURL())
    } catch (error) {
      console.error('Error loading mask image:', error)
      return
    }

    const unrefinedMaskImageData = maskCanvasCtx.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height
    )

    const refinedMaskOnlyData = new ImageData(
      removeImageRgbValuesAndInvertAlpha(unrefinedMaskImageData.data),
      unrefinedMaskImageData.width,
      unrefinedMaskImageData.height
    )

    // We create an undisplayed copy so as not to alter the original--displayed--canvas
    const [refinedMaskCanvas, refinedMaskCanvasCtx] =
      createCanvasCopy(maskCanvas)
    refinedMaskCanvasCtx.globalCompositeOperation =
      CompositionOperation.SourceOver
    refinedMaskCanvasCtx.putImageData(refinedMaskOnlyData, 0, 0)

    const timestamp = Math.round(performance.now())
    const filenames = imageLayerFilenamesByTimestamp(timestamp)
    const refs = {
      maskedImage: toRef(filenames.maskedImage),
      paint: toRef(filenames.paint),
      paintedImage: toRef(filenames.paintedImage),
      paintedMaskedImage: toRef(filenames.paintedMaskedImage)
    }

    const [paintedImageCanvas] = combineOriginalImageAndPaint({
      originalImage: imageCanvas,
      paint: paintCanvas
    })

    replaceClipspaceImages(refs.paintedMaskedImage, [refs.paint])

    const originalImageUrl = new URL(image.src)

    this.uiManager.setBrushOpacity(0)

    const originalImageFilename = originalImageUrl.searchParams.get('filename')
    if (!originalImageFilename)
      throw new Error(
        "Expected original image URL to have a `filename` query parameter, but couldn't find it."
      )

    const originalImageRef: Partial<Ref> = {
      filename: originalImageFilename,
      subfolder: originalImageUrl.searchParams.get('subfolder') ?? undefined,
      type: originalImageUrl.searchParams.get('type') ?? undefined
    }

    const mkFormData = (
      blob: Blob,
      filename: string,
      originalImageRefOverride?: Partial<Ref>
    ) => {
      const formData = new FormData()
      formData.append('image', blob, filename)
      formData.append(
        'original_ref',
        JSON.stringify(originalImageRefOverride ?? originalImageRef)
      )
      formData.append('type', 'input')
      formData.append('subfolder', 'clipspace')
      return formData
    }

    const canvasToFormData = (
      canvas: HTMLCanvasElement,
      filename: string,
      originalImageRefOverride?: Partial<Ref>
    ) => {
      const blob = this.dataURLToBlob(canvas.toDataURL())
      return mkFormData(blob, filename, originalImageRefOverride)
    }

    const formDatas = {
      // Note: this canvas only contains mask data (no image), but during the upload process, the backend combines the mask with the original_image. Refer to the backend repo's `server.py`, search for `@routes.post("/upload/mask")`
      maskedImage: canvasToFormData(refinedMaskCanvas, filenames.maskedImage),
      paint: canvasToFormData(paintCanvas, filenames.paint),
      paintedImage: canvasToFormData(
        paintedImageCanvas,
        filenames.paintedImage
      ),
      paintedMaskedImage: canvasToFormData(
        refinedMaskCanvas,
        filenames.paintedMaskedImage,
        refs.paintedImage
      )
    }

    this.uiManager.setSaveButtonText(t('g.saving'))
    this.uiManager.setSaveButtonEnabled(false)
    this.keyboardManager.removeListeners()

    try {
      await this.uploadMask(
        refs.maskedImage,
        formDatas.maskedImage,
        'selectedIndex'
      )
      await this.uploadImage(refs.paint, formDatas.paint)
      await this.uploadImage(refs.paintedImage, formDatas.paintedImage, false)

      // IMPORTANT: We using `uploadMask` here, because the backend combines the mask with the painted image during the upload process. We do NOT want to combine the mask with the original image on the frontend, because the spec for CanvasRenderingContext2D does not allow for setting pixels to transparent while preserving their RGB values.
      // See: <https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData#data_loss_due_to_browser_optimization>
      // It is possible that WebGL contexts can achieve this, but WebGL is extremely complex, and the backend functionality is here for this purpose!
      // Refer to the backend repo's `server.py`, search for `@routes.post("/upload/mask")`
      await this.uploadMask(
        refs.paintedMaskedImage,
        formDatas.paintedMaskedImage,
        'combinedIndex'
      )

      ComfyApp.onClipspaceEditorSave()
      this.destroy()
    } catch (error) {
      console.error('Error during upload:', error)
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

  private async uploadImage(
    filepath: Ref,
    formData: FormData,
    isPaintLayer = true
  ) {
    const success = await requestWithRetries(() =>
      api.fetchApi('/upload/image', {
        method: 'POST',
        body: formData
      })
    )
    if (!success) {
      throw new Error('Upload failed.')
    }

    if (!isPaintLayer) {
      ClipspaceDialog.invalidatePreview()
      return success
    }
    try {
      const paintedIndex = ComfyApp.clipspace?.paintedIndex
      if (ComfyApp.clipspace?.imgs && paintedIndex !== undefined) {
        // Create and set new image
        const newImage = new Image()
        newImage.crossOrigin = 'anonymous'
        newImage.src = mkFileUrl({ ref: filepath, preview: true })
        ComfyApp.clipspace.imgs[paintedIndex] = newImage

        // Update images array if it exists
        if (ComfyApp.clipspace.images) {
          ComfyApp.clipspace.images[paintedIndex] = filepath
        }
      }
    } catch (err) {
      console.warn('Failed to update clipspace image:', err)
    }
    ClipspaceDialog.invalidatePreview()
  }

  private async uploadMask(
    filepath: Ref,
    formData: FormData,
    clipspaceLocation: 'selectedIndex' | 'combinedIndex'
  ) {
    const success = await requestWithRetries(() =>
      api.fetchApi('/upload/mask', {
        method: 'POST',
        body: formData
      })
    )
    if (!success) {
      throw new Error('Upload failed.')
    }

    try {
      const nameOfIndexToSaveTo = (
        {
          selectedIndex: 'selectedIndex',
          combinedIndex: 'combinedIndex'
        } as const
      )[clipspaceLocation]
      if (!nameOfIndexToSaveTo) return
      const indexToSaveTo = ComfyApp.clipspace?.[nameOfIndexToSaveTo]
      if (!ComfyApp.clipspace?.imgs || indexToSaveTo === undefined) return
      // Create and set new image
      const newImage = new Image()
      newImage.crossOrigin = 'anonymous'
      newImage.src = mkFileUrl({ ref: filepath, preview: true })
      ComfyApp.clipspace.imgs[indexToSaveTo] = newImage

      // Update images array if it exists
      if (ComfyApp.clipspace.images) {
        ComfyApp.clipspace.images[indexToSaveTo] = filepath
      }
    } catch (err) {
      console.warn('Failed to update clipspace image:', err)
    }
    ClipspaceDialog.invalidatePreview()
  }
}
