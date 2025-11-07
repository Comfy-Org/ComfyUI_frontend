import { useMaskEditorDataStore } from '@/stores/maskEditorDataStore'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import type {
  EditorOutputData,
  EditorOutputLayer,
  ImageRef
} from '@/stores/maskEditorDataStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

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
    if (!dataStore.sourceNode || !dataStore.inputData) {
      throw new Error('No source node or input data')
    }

    try {
      const outputData = await prepareOutputData()
      dataStore.outputData = outputData

      await updateNodePreview(dataStore.sourceNode, outputData)

      await uploadAllLayers(outputData)

      updateNodeWithServerReferences(dataStore.sourceNode, outputData)

      app.graph.setDirtyCanvas(true)
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
    const sourceRef = dataStore.inputData!.sourceRef

    await uploadMask(outputData.maskedImage, sourceRef)
    await uploadImage(outputData.paintLayer, sourceRef)
    await uploadImage(outputData.paintedImage, sourceRef)
    await uploadMask(outputData.paintedMaskedImage, outputData.paintedImage.ref)
  }

  async function uploadMask(
    layer: EditorOutputLayer,
    originalRef: ImageRef
  ): Promise<void> {
    const formData = new FormData()
    formData.append('image', layer.blob, layer.ref.filename)
    formData.append('original_ref', JSON.stringify(originalRef))
    formData.append('type', 'input')
    formData.append('subfolder', 'clipspace')

    const response = await api.fetchApi('/upload/mask', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Failed to upload mask: ${layer.ref.filename}`)
    }
  }

  async function uploadImage(
    layer: EditorOutputLayer,
    originalRef: ImageRef
  ): Promise<void> {
    const formData = new FormData()
    formData.append('image', layer.blob, layer.ref.filename)
    formData.append('original_ref', JSON.stringify(originalRef))
    formData.append('type', 'input')
    formData.append('subfolder', 'clipspace')

    const response = await api.fetchApi('/upload/image', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${layer.ref.filename}`)
    }
  }

  async function updateNodePreview(
    node: any,
    outputData: EditorOutputData
  ): Promise<void> {
    const canvas = outputData.paintedMaskedImage.canvas
    const dataUrl = canvas.toDataURL('image/png')

    const mainImg = await loadImageFromUrl(dataUrl)
    node.imgs = [mainImg]

    app.graph.setDirtyCanvas(true)
  }

  function updateNodeWithServerReferences(
    node: any,
    outputData: EditorOutputData
  ): void {
    const mainRef = outputData.paintedMaskedImage.ref

    node.images = [mainRef]

    const imageWidget = node.widgets?.find((w: any) => w.name === 'image')
    if (imageWidget) {
      imageWidget.value = mainRef
      imageWidget.callback?.(mainRef)
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
