import type { LGraphNode } from '@comfyorg/litegraph'
import { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

import MediaLoaderWidget from '@/components/graph/widgets/MediaLoaderWidget.vue'
import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'
import { useValueTransform } from '@/composables/useValueTransform'
import type { ResultItem } from '@/schemas/apiSchema'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { createAnnotatedPath } from '@/utils/formatUtil'
import { addToComboValues } from '@/utils/litegraphUtil'

const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp'
const ACCEPTED_VIDEO_TYPES = 'video/webm,video/mp4'

type InternalFile = string | ResultItem
type InternalValue = InternalFile | InternalFile[]
type ExposedValue = string | string[]

const isImageFile = (file: File) => file.type.startsWith('image/')
const isVideoFile = (file: File) => file.type.startsWith('video/')

const findFileComboWidget = (node: LGraphNode, inputName: string) =>
  node.widgets!.find((w) => w.name === inputName) as IComboWidget & {
    value: ExposedValue
  }

export const useImageUploadMediaWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec
  ) => {
    const inputOptions = inputData[1] ?? {}
    const { imageInputName, allow_batch, image_folder = 'input' } = inputOptions
    const nodeOutputStore = useNodeOutputStore()

    const isAnimated = !!inputOptions.animated_image_upload
    const isVideo = !!inputOptions.video_upload
    const accept = isVideo ? ACCEPTED_VIDEO_TYPES : ACCEPTED_IMAGE_TYPES
    const { showPreview } = isVideo ? useNodeVideo(node) : useNodeImage(node)

    const fileFilter = isVideo ? isVideoFile : isImageFile
    // @ts-expect-error InputSpec is not typed correctly
    const fileComboWidget = findFileComboWidget(node, imageInputName)
    const initialFile = `${fileComboWidget.value}`
    const formatPath = (value: InternalFile) =>
      // @ts-expect-error InputSpec is not typed correctly
      createAnnotatedPath(value, { rootFolder: image_folder })

    const transform = (internalValue: InternalValue): ExposedValue => {
      if (!internalValue) return initialFile
      if (Array.isArray(internalValue))
        return allow_batch
          ? internalValue.map(formatPath)
          : formatPath(internalValue[0])
      return formatPath(internalValue)
    }

    Object.defineProperty(
      fileComboWidget,
      'value',
      useValueTransform(transform, initialFile)
    )

    // Convert the V1 input spec to V2 format for the MediaLoader widget
    const inputSpecV2 = transformInputSpecV1ToV2(inputData, { name: inputName })

    // Handle widget dimensions based on input options
    const getMinHeight = () => {
      let baseHeight = 200

      // Handle multiline attribute for expanded height
      if (inputOptions.multiline) {
        baseHeight = Math.max(
          baseHeight,
          inputOptions.multiline === true
            ? 120
            : Number(inputOptions.multiline) || 120
        )
      }

      // Handle other height-related attributes
      if (inputOptions.min_height) {
        baseHeight = Math.max(baseHeight, Number(inputOptions.min_height))
      }

      return baseHeight + 8 // Add padding
    }

    // Create the MediaLoader widget directly
    const uploadWidget = new ComponentWidgetImpl<string[], { accept?: string }>(
      {
        node,
        name: inputName,
        component: MediaLoaderWidget,
        inputSpec: inputSpecV2,
        props: {
          accept
        },
        options: {
          getValue: () => [],
          setValue: () => {},
          getMinHeight,
          serialize: false,
          onFilesSelected: async (files: File[]) => {
            // Use the existing upload infrastructure
            const { handleUpload } = useNodeImageUpload(node, {
              // @ts-expect-error InputSpec is not typed correctly
              allow_batch,
              fileFilter,
              accept,
              onUploadComplete: (output) => {
                output.forEach((path) =>
                  addToComboValues(fileComboWidget, path)
                )
                // @ts-expect-error litegraph combo value type does not support arrays yet
                fileComboWidget.value = output
                fileComboWidget.callback?.(output)
              }
            })

            // Handle each file
            for (const file of files) {
              if (fileFilter(file)) {
                await handleUpload(file)
              }
            }
          }
        } as any
      }
    )

    // Register the widget with the node
    addWidget(node, uploadWidget as any)

    // Add our own callback to the combo widget to render an image when it changes
    fileComboWidget.callback = function () {
      nodeOutputStore.setNodeOutputs(node, fileComboWidget.value, {
        isAnimated
      })
      node.graph?.setDirtyCanvas(true)
    }

    // On load if we have a value then render the image
    // The value isnt set immediately so we need to wait a moment
    // No change callbacks seem to be fired on initial setting of the value
    requestAnimationFrame(() => {
      nodeOutputStore.setNodeOutputs(node, fileComboWidget.value, {
        isAnimated
      })
      showPreview({ block: false })
    })

    return { widget: uploadWidget }
  }

  return widgetConstructor
}
