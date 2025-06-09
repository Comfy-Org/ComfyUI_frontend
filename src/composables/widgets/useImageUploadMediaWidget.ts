import type { LGraphNode } from '@comfyorg/litegraph'
import { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { ref } from 'vue'

import MediaLoaderWidget from '@/components/graph/widgets/MediaLoaderWidget.vue'
import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { useNodeImagePreview } from '@/composables/node/useNodeImagePreview'
import { useValueTransform } from '@/composables/useValueTransform'
import type { ResultItem } from '@/schemas/apiSchema'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useToastStore } from '@/stores/toastStore'
import { createAnnotatedPath } from '@/utils/formatUtil'
import { addToComboValues } from '@/utils/litegraphUtil'

const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp'
const ACCEPTED_VIDEO_TYPES = 'video/webm,video/mp4'
const PASTED_IMAGE_EXPIRY_MS = 2000

const uploadFile = async (file: File, isPasted: boolean) => {
  const body = new FormData()
  body.append('image', file)
  if (isPasted) body.append('subfolder', 'pasted')

  const resp = await api.fetchApi('/upload/image', {
    method: 'POST',
    body
  })

  if (resp.status !== 200) {
    useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
    return
  }

  const data = await resp.json()
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name
}

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
    const { showImagePreview } = useNodeImagePreview()

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
      // Use smaller height for MediaLoader upload widget
      let baseHeight = 176

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

    const getMaxHeight = () => {
      // Lock maximum height to prevent oversizing of upload widget
      if (inputOptions.multiline || inputOptions.min_height) {
        // Allow more height for special cases
        return Math.max(200, getMinHeight())
      }
      // Lock standard upload widget to ~80px max
      return 80
    }

    // State for MediaLoader widget
    const uploadedFiles = ref<string[]>([])

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
          getValue: () => uploadedFiles.value,
          setValue: (value: string[]) => {
            uploadedFiles.value = value
          },
          getMinHeight,
          getMaxHeight, // Lock maximum height to prevent oversizing
          serialize: false,
          onFilesSelected: async (files: File[]) => {
            const isPastedFile = (file: File): boolean =>
              file.name === 'image.png' &&
              file.lastModified - Date.now() < PASTED_IMAGE_EXPIRY_MS

            const handleUpload = async (file: File) => {
              try {
                const path = await uploadFile(file, isPastedFile(file))
                if (!path) return
                return path
              } catch (error) {
                useToastStore().addAlert(String(error))
              }
            }

            // Filter and upload files
            const filteredFiles = files.filter(fileFilter)
            const paths = await Promise.all(filteredFiles.map(handleUpload))
            const validPaths = paths.filter((p): p is string => !!p)

            if (validPaths.length) {
              validPaths.forEach((path) =>
                addToComboValues(fileComboWidget, path)
              )

              const output = allow_batch ? validPaths : validPaths[0]
              // @ts-expect-error litegraph combo value type does not support arrays yet
              fileComboWidget.value = output

              // Update widget value to show file names
              uploadedFiles.value = Array.isArray(output) ? output : [output]

              // Trigger the combo widget callback to update all dependent widgets
              fileComboWidget.callback?.(output)
            }
          }
        } as any
      }
    )

    // Register the widget with the node
    addWidget(node, uploadWidget as any)

    // Store the original callback if it exists
    const originalCallback = fileComboWidget.callback

    // Add our own callback to the combo widget to render an image when it changes
    fileComboWidget.callback = function (value?: any) {
      // Call original callback first if it exists
      originalCallback?.call(this, value)

      nodeOutputStore.setNodeOutputs(node, fileComboWidget.value, {
        isAnimated
      })

      // Use Vue widget for image preview, fallback to DOM widget for video
      if (!isVideo) {
        showImagePreview(node, fileComboWidget.value, {
          allow_batch: allow_batch as boolean,
          image_folder: image_folder as string,
          imageInputName: imageInputName as string
        })
      }

      node.graph?.setDirtyCanvas(true)
    }

    // On load if we have a value then render the image
    // The value isnt set immediately so we need to wait a moment
    // No change callbacks seem to be fired on initial setting of the value
    requestAnimationFrame(() => {
      nodeOutputStore.setNodeOutputs(node, fileComboWidget.value, {
        isAnimated
      })

      // Use appropriate preview method
      if (isVideo) {
        showPreview({ block: false })
      } else {
        showImagePreview(node, fileComboWidget.value, {
          allow_batch: allow_batch as boolean,
          image_folder: image_folder as string,
          imageInputName: imageInputName as string
        })
      }
    })

    return { widget: uploadWidget }
  }

  return widgetConstructor
}
