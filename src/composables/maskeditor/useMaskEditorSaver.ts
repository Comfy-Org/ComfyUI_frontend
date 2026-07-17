import type { UploadImageResponse } from '@comfyorg/ingest-types'

import { useMaskEditorDataStore } from '@/stores/maskEditorDataStore'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type {
  EditorOutputData,
  EditorOutputLayer,
  ImageRef
} from '@/stores/maskEditorDataStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

// Private layer filename functions
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
    const ctx = canvas.getContext('2d')!

    ctx.drawImage(imgCanvas, 0, 0)

    const maskCtx = maskCanvas.getContext('2d')!
    const maskData = maskCtx.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height
    )

    const refinedMaskData = new Uint8ClampedArray(maskData.data.length)
    for (let i = 0; i < maskData.data.length; i += 4) {
      refinedMaskData[i] = 0
      refinedMaskData[i + 1] = 0
      refinedMaskData[i + 2] = 0
      refinedMaskData[i + 3] = 255 - maskData.data[i + 3]
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i + 3] = refinedMaskData[i + 3]
    }
    ctx.putImageData(imageData, 0, 0)

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
    const ctx = canvas.getContext('2d')!

    ctx.drawImage(imgCanvas, 0, 0)

    ctx.globalCompositeOperation = 'source-over'
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
    const ctx = canvas.getContext('2d')!

    ctx.drawImage(imgCanvas, 0, 0)

    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(paintCanvas, 0, 0)

    const maskCtx = maskCanvas.getContext('2d')!
    const maskData = maskCtx.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height
    )

    const refinedMaskData = new Uint8ClampedArray(maskData.data.length)
    for (let i = 0; i < maskData.data.length; i += 4) {
      refinedMaskData[i] = 0
      refinedMaskData[i + 1] = 0
      refinedMaskData[i + 2] = 0
      refinedMaskData[i + 3] = 255 - maskData.data[i + 3]
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i + 3] = refinedMaskData[i + 3]
    }
    ctx.putImageData(imageData, 0, 0)

    const blob = await canvasToBlob(canvas)
    const ref = createFileRef(filename)

    return { canvas, blob, ref }
  }

  async function uploadAllLayers(outputData: EditorOutputData): Promise<void> {
    const actualMaskedRef = await uploadLayer(outputData.maskedImage)
    const actualPaintRef = await uploadLayer(outputData.paintLayer)
    const actualPaintedRef = await uploadLayer(outputData.paintedImage)
    const actualPaintedMaskedRef = await uploadLayer(
      outputData.paintedMaskedImage
    )

    outputData.maskedImage.ref = actualMaskedRef
    outputData.paintLayer.ref = actualPaintRef
    outputData.paintedImage.ref = actualPaintedRef
    outputData.paintedMaskedImage.ref = actualPaintedMaskedRef
  }

  async function uploadLayer(layer: EditorOutputLayer): Promise<ImageRef> {
    const formData = new FormData()
    formData.append('image', layer.blob, layer.ref.filename)
    formData.append('type', 'input')

    const response = await api.fetchApi('/upload/image', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Failed to upload ${layer.ref.filename} (${response.status}${body ? `: ${body}` : ''})`
      )
    }

    let data: UploadImageResponse
    try {
      data = await response.json()
    } catch (error) {
      throw new Error(
        `Invalid upload response for ${layer.ref.filename}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error }
      )
    }

    if (!data?.name) {
      throw new Error(
        `Upload response missing 'name' for ${layer.ref.filename}`
      )
    }

    return {
      filename: data.name,
      subfolder: data.subfolder || '',
      type: data.type || 'input'
    }
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
      const widgetValue =
        mainRef.filename + (mainRef.type ? ` [${mainRef.type}]` : '')

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
    }

    node.imgs = undefined
    const annotatedPath = createAnnotatedPath(mainRef.filename, {
      subfolder: mainRef.subfolder,
      rootFolder: mainRef.type
    })
    nodeOutputStore.setNodeOutputs(node, annotatedPath, { folder: 'input' })
    node.graph?.setDirtyCanvas(true)
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
    const ctx = canvas.getContext('2d')!
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
