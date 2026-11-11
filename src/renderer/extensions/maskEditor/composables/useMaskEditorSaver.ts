import type { UploadImageResponse } from '@comfyorg/ingest-types'

import { writeImageWidgetValue } from '@/renderer/extensions/maskEditor/composables/imageWidgetAdapter'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMaskEditorDataStore } from '@/renderer/extensions/maskEditor/stores/maskEditorDataStore'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type {
  EditorOutputData,
  EditorOutputLayer,
  ImageRef
} from '@/renderer/extensions/maskEditor/stores/maskEditorDataStore'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { createImageOutput } from '@comfyorg/mask-editor/imageOutput'
import { imageLayerFilenamesByTimestamp } from './layerFilenames'
import { isResultItemType } from '@/utils/typeGuardUtil'

export function useMaskEditorSaver() {
  const dataStore = useMaskEditorDataStore()
  const editorStore = useMaskEditorStore()
  const nodeOutputStore = useNodeOutputStore()

  const save = async (): Promise<void> => {
    const sourceNode = dataStore.sourceNode
    if (!sourceNode || !dataStore.inputData) {
      throw new Error('No source node or input data')
    }

    try {
      const outputData = await prepareOutputData()
      dataStore.outputData = outputData

      await updateNodePreview(sourceNode, outputData)

      await uploadAllLayers(outputData)

      updateNodeWithServerReferences(sourceNode, outputData)

      useApp().canvas.setDirty(true)
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

    const layers = await createImageOutput({
      imgCanvas,
      maskCanvas,
      paintCanvas
    })

    return {
      maskedImage: {
        ...layers.maskedImage,
        ref: createFileRef(filenames.maskedImage)
      },
      paintLayer: { ...layers.paintLayer, ref: createFileRef(filenames.paint) },
      paintedImage: {
        ...layers.paintedImage,
        ref: createFileRef(filenames.paintedImage)
      },
      paintedMaskedImage: {
        ...layers.paintedMaskedImage,
        ref: createFileRef(filenames.paintedMaskedImage)
      }
    }
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

    if (!data.name) {
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

    useApp().canvas.setDirty(true)
  }

  function updateNodeWithServerReferences(
    node: LGraphNode,
    outputData: EditorOutputData
  ): void {
    if (!node.graph) return

    const mainRef = outputData.paintedMaskedImage.ref

    writeImageWidgetValue(
      node,
      mainRef.filename + (mainRef.type ? ` [${mainRef.type}]` : '')
    )

    node.imgs = undefined
    nodeOutputStore.replaceNodeOutputImages(node, [
      {
        filename: mainRef.filename,
        subfolder: mainRef.subfolder,
        type: isResultItemType(mainRef.type) ? mainRef.type : 'input'
      }
    ])
    node.graph.setDirtyCanvas(true)
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
