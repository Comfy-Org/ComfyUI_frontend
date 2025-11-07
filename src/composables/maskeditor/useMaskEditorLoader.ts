import { useMaskEditorDataStore } from '@/stores/maskEditorDataStore'
import type { ImageRef, ImageLayer } from '@/stores/maskEditorDataStore'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

// Private image utility functions
interface ImageLayerFilenames {
  maskedImage: string
  paint: string
  paintedImage: string
  paintedMaskedImage: string
}

const paintedMaskedImagePrefix = 'clipspace-painted-masked-'

function imageLayerFilenamesIfApplicable(
  inputImageFilename: string
): ImageLayerFilenames | undefined {
  const isPaintedMaskedImageFilename = inputImageFilename.startsWith(
    paintedMaskedImagePrefix
  )
  if (!isPaintedMaskedImageFilename) return undefined
  const suffix = inputImageFilename.slice(paintedMaskedImagePrefix.length)
  const timestamp = parseInt(suffix.split('.')[0], 10)
  return {
    maskedImage: `clipspace-mask-${timestamp}.png`,
    paint: `clipspace-paint-${timestamp}.png`,
    paintedImage: `clipspace-painted-${timestamp}.png`,
    paintedMaskedImage: `${paintedMaskedImagePrefix}${timestamp}.png`
  }
}

function toRef(filename: string): ImageRef {
  return {
    filename,
    subfolder: 'clipspace',
    type: 'input'
  }
}

function mkFileUrl(props: { ref: ImageRef; preview?: boolean }): string {
  const params = new URLSearchParams()
  params.set('filename', props.ref.filename)
  if (props.ref.subfolder) {
    params.set('subfolder', props.ref.subfolder)
  }
  if (props.ref.type) {
    params.set('type', props.ref.type)
  }

  const pathPlusQueryParams = api.apiURL(
    '/view?' +
      params.toString() +
      app.getPreviewFormatParam() +
      app.getRandParam()
  )
  const imageElement = new Image()
  imageElement.src = pathPlusQueryParams
  return imageElement.src
}

export function useMaskEditorLoader() {
  const dataStore = useMaskEditorDataStore()
  const nodeOutputStore = useNodeOutputStore()

  const loadFromNode = async (node: LGraphNode): Promise<void> => {
    dataStore.setLoading(true)

    try {
      validateNode(node)

      const nodeImageUrl = getNodeImageUrl(node)

      const nodeImageRef = parseImageRef(nodeImageUrl)

      const imageLayerFilenames = imageLayerFilenamesIfApplicable(
        nodeImageRef.filename
      )
      const baseImageUrl = imageLayerFilenames?.maskedImage
        ? mkFileUrl({ ref: toRef(imageLayerFilenames.maskedImage) })
        : nodeImageUrl

      const sourceRef = imageLayerFilenames?.maskedImage
        ? parseImageRef(baseImageUrl)
        : nodeImageRef

      const paintLayerUrl = imageLayerFilenames?.paint
        ? mkFileUrl({ ref: toRef(imageLayerFilenames.paint) })
        : null

      const [baseLayer, maskLayer, paintLayer] = await Promise.all([
        loadImageLayer(baseImageUrl, 'rgb'),
        loadImageLayer(baseImageUrl, 'a'),
        paintLayerUrl
          ? loadPaintLayer(paintLayerUrl)
          : Promise.resolve(undefined)
      ])

      dataStore.inputData = {
        baseLayer,
        maskLayer,
        paintLayer,
        sourceRef,
        nodeId: node.id
      }

      dataStore.sourceNode = node
      dataStore.setLoading(false)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load from node'
      console.error('[MaskEditorLoader]', errorMessage, error)
      dataStore.setLoading(false, errorMessage)
      throw error
    }
  }

  function validateNode(node: LGraphNode): void {
    if (!node) {
      throw new Error('Node is null or undefined')
    }

    const hasImages = node.imgs?.length || node.previewMediaType === 'image'
    if (!hasImages) {
      throw new Error('Node has no images')
    }
  }

  function getNodeImageUrl(node: LGraphNode): string {
    if (node.images?.[0]) {
      const img = node.images[0]
      const params = new URLSearchParams({
        filename: img.filename,
        type: img.type || 'output',
        subfolder: img.subfolder || ''
      })
      return api.apiURL(`/view?${params.toString()}`)
    }

    const outputs = nodeOutputStore.getNodeOutputs(node)
    if (outputs?.images?.[0]) {
      const img = outputs.images[0]
      if (!img.filename) {
        throw new Error('nodeOutputStore image missing filename')
      }

      const params = new URLSearchParams()
      params.set('filename', img.filename)
      params.set('type', img.type || 'output')
      params.set('subfolder', img.subfolder || '')
      return api.apiURL(`/view?${params.toString()}`)
    }

    if (node.imgs?.length) {
      const index = node.imageIndex ?? 0
      const imgSrc = node.imgs[index].src

      if (imgSrc && !imgSrc.startsWith('data:')) {
        return imgSrc
      }
    }

    throw new Error('Unable to get image URL from node')
  }

  function parseImageRef(url: string): ImageRef {
    try {
      const urlObj = new URL(url)
      const filename = urlObj.searchParams.get('filename')

      if (!filename) {
        throw new Error('Image URL missing filename parameter')
      }

      return {
        filename,
        subfolder: urlObj.searchParams.get('subfolder') || undefined,
        type: urlObj.searchParams.get('type') || undefined
      }
    } catch (error) {
      try {
        const urlObj = new URL(url, window.location.origin)
        const filename = urlObj.searchParams.get('filename')

        if (!filename) {
          throw new Error('Image URL missing filename parameter')
        }

        return {
          filename,
          subfolder: urlObj.searchParams.get('subfolder') || undefined,
          type: urlObj.searchParams.get('type') || undefined
        }
      } catch (e) {
        throw new Error(`Invalid image URL: ${url}`)
      }
    }
  }

  async function loadImageLayer(
    url: string,
    channel?: 'rgb' | 'a'
  ): Promise<ImageLayer> {
    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      urlObj = new URL(url, window.location.origin)
    }

    if (channel) {
      urlObj.searchParams.delete('channel')
      urlObj.searchParams.set('channel', channel)
    }

    const finalUrl = urlObj.toString()
    const image = await loadImage(finalUrl)

    return { image, url: finalUrl }
  }

  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`))

      img.src = url
    })
  }

  async function loadPaintLayer(url: string): Promise<ImageLayer> {
    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      urlObj = new URL(url, window.location.origin)
    }

    const finalUrl = urlObj.toString()
    const image = await loadImage(finalUrl)

    return { image, url: finalUrl }
  }

  return {
    loadFromNode
  }
}
