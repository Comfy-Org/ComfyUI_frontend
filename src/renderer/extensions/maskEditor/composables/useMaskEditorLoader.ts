import { IMAGE_WIDGET } from '@/renderer/extensions/maskEditor/composables/imageWidgetAdapter'
import { getNodeWidgetValue } from '@/core/graph/widgets/nodeWidgetValues'
import { useMaskEditorDataStore } from '@/renderer/extensions/maskEditor/stores/maskEditorDataStore'
import type {
  ImageRef,
  LoadedImageLayer
} from '@/renderer/extensions/maskEditor/stores/maskEditorDataStore'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { fullResolutionSrc } from '@/utils/hdrFormatUtil'
import {
  extractWidgetStringValue,
  parseImageWidgetValue
} from '@/utils/imageUtil'

import { imageLayerFilenamesIfApplicable } from './layerFilenames'

interface MaskLayersResponse {
  painted_masked?: string
  painted?: string
  paint?: string
  mask?: string
}

function toRef(filename: string, subfolder: string): ImageRef {
  return {
    filename,
    subfolder,
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
      useApp().getPreviewFormatParam() +
      useApp().getRandParam()
  )
  const imageElement = new Image()
  imageElement.crossOrigin = 'anonymous'
  imageElement.src = pathPlusQueryParams
  return imageElement.src
}

export function useMaskEditorLoader() {
  const dataStore = useMaskEditorDataStore()
  const nodeOutputStore = useNodeOutputStore()

  const loadFromNode = async (
    node: LGraphNode,
    signal?: AbortSignal
  ): Promise<void> => {
    if (signal?.aborted) return
    dataStore.setLoading(true)

    try {
      validateNode(node)

      let nodeImageUrl = getNodeImageUrl(node)

      let nodeImageRef = parseImageRef(nodeImageUrl)

      const widgetFilename = extractWidgetStringValue(
        getNodeWidgetValue(node, IMAGE_WIDGET)
      )

      if (widgetFilename && !widgetFilename.startsWith('$')) {
        const parsed = parseImageWidgetValue(widgetFilename)
        nodeImageRef = {
          filename: parsed.filename,
          type: parsed.type || 'input',
          subfolder: parsed.subfolder || undefined
        }
        nodeImageUrl = mkFileUrl({ ref: nodeImageRef })
      }

      const fileToQuery = widgetFilename || nodeImageRef.filename

      let maskLayersFromApi: MaskLayersResponse | undefined
      if (isCloud) {
        try {
          const response = await api.fetchApi(
            `/files/mask-layers?filename=${fileToQuery}`
          )
          if (response.ok) {
            maskLayersFromApi = await response.json()
          }
        } catch {
          maskLayersFromApi = undefined
        }
      }

      let imageLayerFilenames = imageLayerFilenamesIfApplicable(
        nodeImageRef.filename
      )

      if (maskLayersFromApi) {
        const baseFile =
          maskLayersFromApi.painted_masked || maskLayersFromApi.painted

        if (baseFile) {
          imageLayerFilenames = {
            maskedImage: baseFile,
            paint: maskLayersFromApi.paint || '',
            paintedImage: maskLayersFromApi.painted || '',
            paintedMaskedImage: maskLayersFromApi.painted_masked || baseFile
          }
        }
      }

      const layerSubfolder = maskLayersFromApi
        ? 'clipspace'
        : (nodeImageRef.subfolder ?? '')

      const layeredBaseUrl = imageLayerFilenames?.maskedImage
        ? mkFileUrl({
            ref: toRef(imageLayerFilenames.maskedImage, layerSubfolder)
          })
        : undefined
      const baseImageUrl = layeredBaseUrl ?? nodeImageUrl

      let paintLayerUrl: string | null = null
      if (maskLayersFromApi?.paint) {
        paintLayerUrl = mkFileUrl({
          ref: toRef(maskLayersFromApi.paint, layerSubfolder)
        })
      } else if (imageLayerFilenames?.paint) {
        paintLayerUrl = mkFileUrl({
          ref: toRef(imageLayerFilenames.paint, layerSubfolder)
        })
      }

      const loadLayers = (baseUrl: string, paintUrl: string | null) =>
        Promise.all([
          loadImageLayer(baseUrl, 'rgb'),
          loadImageLayer(baseUrl, 'a'),
          paintUrl ? loadImageLayer(paintUrl) : Promise.resolve(undefined)
        ])

      const loadInputData = async () => {
        try {
          const [baseLayer, maskLayer, paintLayer] = await loadLayers(
            baseImageUrl,
            paintLayerUrl
          )
          return {
            baseLayer,
            maskLayer,
            paintLayer,
            sourceRef: layeredBaseUrl
              ? parseImageRef(baseImageUrl)
              : nodeImageRef
          }
        } catch (error) {
          if (!layeredBaseUrl) throw error
          console.warn(
            '[MaskEditorLoader] Failed to load editor layer files, falling back to the node image',
            error
          )
          const [baseLayer, maskLayer] = await loadLayers(nodeImageUrl, null)
          return {
            baseLayer,
            maskLayer,
            paintLayer: undefined,
            sourceRef: nodeImageRef
          }
        }
      }

      const inputData = await loadInputData()
      if (signal?.aborted) return
      dataStore.inputData = { ...inputData, nodeId: node.id }
      dataStore.sourceNode = node
      dataStore.setLoading(false)
    } catch (error) {
      if (signal?.aborted) return
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load from node'
      console.error('[MaskEditorLoader]', errorMessage, error)
      dataStore.setLoading(false, errorMessage)
      throw error
    }
  }

  function validateNode(node: LGraphNode): void {
    const hasImages = node.imgs?.length || node.previewMediaType === 'image'
    if (!hasImages) {
      throw new Error('Node has no images')
    }
  }

  function getNodeImageUrl(node: LGraphNode): string {
    const nodeImage = node.images?.[0]
    if (nodeImage?.filename) {
      const params = new URLSearchParams({
        filename: nodeImage.filename,
        type: nodeImage.type || 'output',
        subfolder: nodeImage.subfolder || ''
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
      const imgSrc = fullResolutionSrc(node.imgs[index])

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
          throw new Error('Image URL missing filename parameter', {
            cause: error
          })
        }

        return {
          filename,
          subfolder: urlObj.searchParams.get('subfolder') || undefined,
          type: urlObj.searchParams.get('type') || undefined
        }
      } catch (e) {
        throw new Error(`Invalid image URL: ${url}`, { cause: e })
      }
    }
  }

  async function loadImageLayer(
    url: string,
    channel?: 'rgb' | 'a'
  ): Promise<LoadedImageLayer> {
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

  return {
    loadFromNode
  }
}
