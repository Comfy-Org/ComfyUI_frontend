import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'
import { useValueTransform } from '@/composables/useValueTransform'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { IComboWidget } from '@/lib/litegraph/src/types/widgets'
import type { ResultItem, ResultItemType } from '@/schemas/apiSchema'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import type { ComfyWidgetConstructor } from '@/scripts/widgets'
import { fileNameMappingService } from '@/services/fileNameMappingService'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { isImageUploadInput } from '@/types/nodeDefAugmentation'
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

export const useImageUploadWidget = () => {
  const widgetConstructor: ComfyWidgetConstructor = (
    node: LGraphNode,
    inputName: string,
    inputData: InputSpec
  ) => {
    if (!isImageUploadInput(inputData)) {
      throw new Error(
        'Image upload widget requires imageInputName augmentation'
      )
    }

    const inputOptions = inputData[1]
    const { imageInputName, allow_batch, image_folder = 'input' } = inputOptions
    const folder: ResultItemType | undefined = image_folder
    const nodeOutputStore = useNodeOutputStore()

    const isAnimated = !!inputOptions.animated_image_upload
    const isVideo = !!inputOptions.video_upload
    const accept = isVideo ? ACCEPTED_VIDEO_TYPES : ACCEPTED_IMAGE_TYPES
    const { showPreview } = isVideo ? useNodeVideo(node) : useNodeImage(node)

    const fileFilter = isVideo ? isVideoFile : isImageFile
    const fileComboWidget = findFileComboWidget(node, imageInputName)
    const initialFile = `${fileComboWidget.value}`
    const formatPath = (value: InternalFile) =>
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

    // Setup file upload handling
    const { openFileSelection } = useNodeImageUpload(node, {
      allow_batch,
      fileFilter,
      accept,
      folder,
      onUploadComplete: async (output) => {
        console.debug('[ImageUpload] Upload complete, output:', output)

        // CRITICAL: Refresh mappings FIRST before updating dropdown
        // This ensures new hash→human mappings are available when dropdown renders
        try {
          await fileNameMappingService.refreshMapping('input')
          console.debug(
            '[ImageUpload] Filename mappings refreshed, updating dropdown'
          )
        } catch (error) {
          console.debug(
            '[ImageUpload] Failed to refresh filename mappings:',
            error
          )
          // Continue anyway - will show hash values as fallback
        }

        // Now add the files to dropdown - addToComboValues will trigger refreshMappings
        output.forEach((path) => {
          console.debug('[ImageUpload] Adding to combo values:', path)
          addToComboValues(fileComboWidget, path)
        })

        // Set the widget value to the newly uploaded files
        // Use the last uploaded file for single selection widgets
        const selectedValue = allow_batch ? output : output[output.length - 1]

        // @ts-expect-error litegraph combo value type does not support arrays yet
        fileComboWidget.value = selectedValue
        fileComboWidget.callback?.(selectedValue)

        // Force one more refresh to ensure UI is in sync
        if (typeof (fileComboWidget as any).refreshMappings === 'function') {
          console.debug('[ImageUpload] Final refreshMappings call for UI sync')
          ;(fileComboWidget as any).refreshMappings()
        }

        // Trigger UI update to show human-readable names
        node.setDirtyCanvas?.(true, true)
        node.graph?.setDirtyCanvas?.(true, true)

        console.debug('[ImageUpload] Upload handling complete')
      }
    })

    // Create the button widget for selecting the files
    const uploadWidget = node.addWidget(
      'button',
      inputName,
      'image',
      () => openFileSelection(),
      {
        serialize: false
      }
    )
    uploadWidget.label = t('g.choose_file_to_upload')

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
