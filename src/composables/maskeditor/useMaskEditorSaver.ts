import { useMaskEditorDataStore } from '@/stores/maskEditorDataStore'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type {
  EditorOutputData,
  EditorOutputLayer,
  ImageRef
} from '@/stores/maskEditorDataStore'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

interface ImageLayerFilenames {
  maskedImage: string
  paint: string
  paintedImage: string
  paintedMaskedImage: string
}

function imageLayerFilenamesByTimestamp(
  timestamp: number
): ImageLayerFilenames {
  return {
    maskedImage: `clipspace-mask-${timestamp}.png`,
    paint: `clipspace-paint-${timestamp}.png`,
    paintedImage: `clipspace-painted-${timestamp}.png`,
    paintedMaskedImage: `clipspace-painted-masked-${timestamp}.png`
  }
}

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2D rendering context')
  return ctx
}

function applyInvertedMaskAlpha(
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement
): void {
  const maskCtx = getContext2D(maskCanvas)
  const maskData = maskCtx.getImageData(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height
  )

  const { width, height } = targetCtx.canvas
  const imageData = targetCtx.getImageData(0, 0, width, height)
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i + 3] = 255 - maskData.data[i + 3]
  }
  targetCtx.putImageData(imageData, 0, 0)
}

export function useMaskEditorSaver() {
  const dataStore = useMaskEditorDataStore()
  const editorStore = useMaskEditorStore()
  const nodeOutputStore = useNodeOutputStore()

  const save = async (): Promise<void> => {
    const sourceNode = dataStore.sourceNode as LGraphNode
    if (!sourceNode || !dataStore.inputData) {
      throw new Error('No source node or input data')
    }

    try {
      const outputData = await prepareOutputData()
      dataStore.outputData = outputData

      await updateNodePreview(sourceNode, outputData)

      await uploadAllLayers(outputData)

      updateNodeWithServerReferences(sourceNode, outputData)

      app.canvas.setDirty(true)
    } catch (error) {
      console.error('[MaskEditorSaver] Save failed:', error)
      throw error
    }
  }

  async function prepareOutputData(): Promise<EditorOutputData> {
    const maskCanvas = editorStore.maskCanvas
    const paintCanvas = editorStore.rgbCanvas
    const imgCanvas = editorStore.imgCanvas

    if (!maskCanvas || !paintCanvas || !imgCanvas) {
      throw new Error('Canvas not initialized')
    }

    const timestamp = Date.now()
    const filenames = imageLayerFilenamesByTimestamp(timestamp)

    const [maskedImage, paintLayer, paintedImage, paintedMaskedImage] =
      await Promise.all([
        createMaskedImage(imgCanvas, maskCanvas, filenames.maskedImage),
        createPaintLayer(paintCanvas, filenames.paint),
        createPaintedImage(imgCanvas, paintCanvas, filenames.paintedImage),
        createPaintedMaskedImage(
          imgCanvas,
          paintCanvas,
          maskCanvas,
          filenames.paintedMaskedImage
        )
      ])

    return {
      maskedImage,
      paintLayer,
      paintedImage,
      paintedMaskedImage
    }
  }

  async function createMaskedImage(
    imgCanvas: HTMLCanvasElement,
    maskCanvas: HTMLCanvasElement,
    filename: string
  ): Promise<EditorOutputLayer> {
    const canvas = document.createElement('canvas')
    canvas.width = imgCanvas.width
    canvas.height = imgCanvas.height
    const ctx = getContext2D(canvas)

    ctx.drawImage(imgCanvas, 0, 0)
    applyInvertedMaskAlpha(ctx, maskCanvas)

    const blob = await canvasToBlob(canvas)
    const ref = createFileRef(filename)

    return { canvas, blob, ref }
  }

  async function createPaintLayer(
    paintCanvas: HTMLCanvasElement,
    filename: string
  ): Promise<EditorOutputLayer> {
    const canvas = cloneCanvas(paintCanvas)
    const blob = await canvasToBlob(canvas)
    const ref = createFileRef(filename)

    return { canvas, blob, ref }
  }

  async function createPaintedImage(
    imgCanvas: HTMLCanvasElement,
    paintCanvas: HTMLCanvasElement,
    filename: string
  ): Promise<EditorOutputLayer> {
    const canvas = document.createElement('canvas')
    canvas.width = imgCanvas.width
    canvas.height = imgCanvas.height
    const ctx = getContext2D(canvas)

    ctx.drawImage(imgCanvas, 0, 0)
    ctx.drawImage(paintCanvas, 0, 0)

    const blob = await canvasToBlob(canvas)
    const ref = createFileRef(filename)

    return { canvas, blob, ref }
  }

  async function createPaintedMaskedImage(
    imgCanvas: HTMLCanvasElement,
    paintCanvas: HTMLCanvasElement,
    maskCanvas: HTMLCanvasElement,
    filename: string
  ): Promise<EditorOutputLayer> {
    const canvas = document.createElement('canvas')
    canvas.width = imgCanvas.width
    canvas.height = imgCanvas.height
    const ctx = getContext2D(canvas)

    ctx.drawImage(imgCanvas, 0, 0)
    ctx.drawImage(paintCanvas, 0, 0)
    applyInvertedMaskAlpha(ctx, maskCanvas)

    const blob = await canvasToBlob(canvas)
    const ref = createFileRef(filename)

    return { canvas, blob, ref }
  }

  async function uploadAllLayers(outputData: EditorOutputData): Promise<void> {
    const sourceRef = dataStore.inputData!.sourceRef

    const actualMaskedRef = await uploadLayer(
      outputData.maskedImage,
      sourceRef,
      '/upload/mask'
    )
    const actualPaintRef = await uploadLayer(
      outputData.paintLayer,
      sourceRef,
      '/upload/image'
    )
    const actualPaintedRef = await uploadLayer(
      outputData.paintedImage,
      sourceRef,
      '/upload/image'
    )

    const actualPaintedMaskedRef = await uploadLayer(
      outputData.paintedMaskedImage,
      actualPaintedRef,
      '/upload/mask'
    )

    outputData.maskedImage.ref = actualMaskedRef
    outputData.paintLayer.ref = actualPaintRef
    outputData.paintedImage.ref = actualPaintedRef
    outputData.paintedMaskedImage.ref = actualPaintedMaskedRef
  }

  async function uploadLayer(
    layer: EditorOutputLayer,
    originalRef: ImageRef,
    endpoint: '/upload/mask' | '/upload/image'
  ): Promise<ImageRef> {
    const formData = new FormData()
    formData.append('image', layer.blob, layer.ref.filename)
    formData.append('original_ref', JSON.stringify(originalRef))
    formData.append('type', 'input')
    formData.append('subfolder', 'clipspace')

    const response = await api.fetchApi(endpoint, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Failed to upload to ${endpoint}: ${layer.ref.filename}`)
    }

    const data = await response.json()
    if (data?.name) {
      return {
        filename: data.name,
        subfolder: data.subfolder || layer.ref.subfolder,
        type: data.type || layer.ref.type
      }
    }

    return layer.ref
  }

  async function updateNodePreview(
    node: LGraphNode,
    outputData: EditorOutputData
  ): Promise<void> {
    const canvas = outputData.paintedMaskedImage.canvas
    const dataUrl = canvas.toDataURL('image/png')

    const mainImg = await loadImageFromUrl(dataUrl)
    node.imgs = [mainImg]

    app.canvas.setDirty(true)
  }

  function updateNodeWithServerReferences(
    node: LGraphNode,
    outputData: EditorOutputData
  ): void {
    const mainRef = outputData.paintedMaskedImage.ref

    node.images = [mainRef]

    const imageWidget = node.widgets?.find((w) => w.name === 'image')
    if (imageWidget) {
      // Widget value format differs between Cloud and OSS:
      // - Cloud: JUST the filename (subfolder handled by backend)
      // - OSS: subfolder/filename (traditional format)
      let widgetValue: string
      if (isCloud) {
        widgetValue =
          mainRef.filename + (mainRef.type ? ` [${mainRef.type}]` : '')
      } else {
        widgetValue =
          (mainRef.subfolder ? mainRef.subfolder + '/' : '') +
          mainRef.filename +
          (mainRef.type ? ` [${mainRef.type}]` : '')
      }

      imageWidget.value = widgetValue

      if (node.properties) {
        node.properties['image'] = widgetValue
      }

      if (node.widgets_values && node.widgets) {
        const widgetIndex = node.widgets.indexOf(imageWidget)
        if (widgetIndex >= 0) {
          node.widgets_values[widgetIndex] = widgetValue
        }
      }

      imageWidget.callback?.(widgetValue)
    }

    nodeOutputStore.updateNodeImages(node)
  }

  function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => resolve(img)
      img.onerror = (error) => {
        console.error('[MaskEditorSaver] Failed to load image:', url, error)
        reject(new Error(`Failed to load image: ${url}`))
      }

      img.src = url
    })
  }

  function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const ctx = getContext2D(canvas)
    ctx.drawImage(source, 0, 0)
    return canvas
  }

  function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob from canvas'))
      }, 'image/png')
    })
  }

  function createFileRef(filename: string): ImageRef {
    return {
      filename,
      subfolder: 'clipspace',
      type: 'input'
    }
  }

  return {
    save
  }
}
