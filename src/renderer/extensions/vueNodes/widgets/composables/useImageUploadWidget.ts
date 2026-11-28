import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@comfyorg/graph-model/widgets'
import type { ResultItem } from '@comfyorg/api-client/executionTypes'
import type { ResultItemType } from '@comfyorg/api-client/resultItemTypeSchema'
import { getMediaSelectionLimits } from '@comfyorg/object-info-parser'
import type { InputSpec } from '@comfyorg/object-info-parser'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useToast } from '@/components/ui/toast/toastStore'
import type { ComfyWidgetConstructor } from '@/types/comfy'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { isImageUploadInput } from '@/types/nodeDefAugmentation'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { addToComboValues } from '@/utils/litegraphUtil'

import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  appendToMediaSelection,
  isUntypedOrVideoWithoutExtension,
  isUploadableVideo,
  toMediaSelection
} from '@/utils/mediaUploadUtil'

function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

type ImageUploadComboWidget = Omit<IComboWidget, 'value' | 'callback'> & {
  value: string | number | string[]
  callback?: (value: string | number | string[]) => void
}

const findFileComboWidget = (
  node: LGraphNode,
  inputName: string
): ImageUploadComboWidget | undefined =>
  node.widgets?.find((w): w is ImageUploadComboWidget => w.name === inputName)

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
    const selectionLimits = getMediaSelectionLimits(inputOptions)

    const isAnimated = !!inputOptions.animated_image_upload
    const isVideo = !!inputOptions.video_upload
    const accept = isVideo ? ACCEPTED_VIDEO_TYPES : ACCEPTED_IMAGE_TYPES
    const { showPreview } = isVideo ? useNodeVideo(node) : useNodeImage(node)
    function showCanvasPreview() {
      if (isVideo || !LiteGraph.vueNodesMode) showPreview({ block: false })
    }

    const fileFilter = isVideo ? isUploadableVideo : isImageFile
    function alertExtensionlessVideo(files: File[]) {
      if (!files.some(isUntypedOrVideoWithoutExtension)) return false
      useToast().warning(t('g.videoFilenameExtensionRequired'))
      return true
    }
    const fileComboWidget = findFileComboWidget(node, imageInputName)
    if (!fileComboWidget) {
      throw new Error(`Widget "${imageInputName}" not found on node`)
    }
    function formatPath(value: string | ResultItem) {
      return typeof value === 'string'
        ? createAnnotatedPath(value, { rootFolder: image_folder })
        : createAnnotatedPath(value)
    }

    // Setup file upload handling
    let rollback: (() => void) | undefined
    const { openFileSelection } = useNodeImageUpload(node, {
      allow_batch: selectionLimits ? selectionLimits.max > 1 : allow_batch,
      fileFilter,
      accept,
      folder,
      onReject: isVideo ? alertExtensionlessVideo : undefined,
      onUploadStart: (files) => {
        if (files.length > 0 && !selectionLimits) {
          const prev = fileComboWidget.value
          fileComboWidget.value = files[0].name
          rollback = () => {
            fileComboWidget.value = prev
          }
        }
      },
      onUploadError: () => {
        rollback?.()
        rollback = undefined
      },
      onUploadComplete: (output) => {
        rollback = undefined
        const annotated = output.map(formatPath)
        annotated.forEach((path) => {
          addToComboValues(fileComboWidget, path)
        })

        const newValue = selectionLimits
          ? appendToMediaSelection(
              fileComboWidget.value,
              annotated,
              selectionLimits.max
            )
          : allow_batch
            ? annotated
            : annotated[0]
        const oldValue = fileComboWidget.value

        fileComboWidget.value = newValue
        fileComboWidget.callback?.(newValue)
        node.onWidgetChanged?.(
          fileComboWidget.name,
          newValue,
          oldValue,
          fileComboWidget
        )
        useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
      }
    })

    // Create the button widget for selecting the files
    const uploadWidget = node.addWidget(
      'button',
      inputName,
      'image',
      () => openFileSelection(),
      {
        serialize: false,
        socketless: true,
        surfaces: { canvas: 'shown', vueNode: 'never', panel: 'never' }
      }
    )
    uploadWidget.label = t('g.choose_file_to_upload')

    function showSelectedMedia(
      value: ImageUploadComboWidget['value'] | null | undefined
    ) {
      if (!selectionLimits) {
        if (value != null)
          nodeOutputStore.setNodeOutputs(node, String(value), { isAnimated })
        return
      }
      const names = toMediaSelection(value)
      if (names.length)
        nodeOutputStore.setNodeOutputs(node, names, { isAnimated })
      else nodeOutputStore.removeNodeOutputsForNode(node)
    }

    fileComboWidget.callback = function () {
      if (selectionLimits && !Array.isArray(fileComboWidget.value))
        fileComboWidget.value = toMediaSelection(fileComboWidget.value)
      node.imgs = undefined
      showSelectedMedia(fileComboWidget.value)
      showCanvasPreview()
      node.graph?.setDirtyCanvas(true)
    }

    requestAnimationFrame(() => {
      showSelectedMedia(fileComboWidget.value)
      showCanvasPreview()
    })

    return { widget: uploadWidget }
  }

  return widgetConstructor
}
