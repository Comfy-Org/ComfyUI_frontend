import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeImage, useNodeVideo } from '@/composables/node/useNodeImage'
import { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@comfyorg/graph-model/widgets'
import type { DraggedAssetInfo } from '@/platform/assets/integration/assetDrop'
import type { ResultItem } from '@comfyorg/api-client/executionTypes'
import type { ResultItemType } from '@comfyorg/api-client/resultItemTypeSchema'
import type { InputSpec } from '@comfyorg/object-info-parser'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useToast } from '@/components/ui/toast/toastStore'
import type { ComfyWidgetConstructor } from '@/types/comfy'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { isImageUploadInput } from '@/types/nodeDefAugmentation'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { addToComboValues } from '@/utils/litegraphUtil'

import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  isUntypedOrVideoWithoutExtension,
  isUploadableVideo
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

    const isAnimated = !!inputOptions.animated_image_upload
    const isVideo = !!inputOptions.video_upload
    const accept = isVideo ? ACCEPTED_VIDEO_TYPES : ACCEPTED_IMAGE_TYPES
    const { showPreview } = isVideo ? useNodeVideo(node) : useNodeImage(node)
    function showCanvasPreview() {
      if (isVideo || !LiteGraph.vueNodesMode) showPreview({ block: false })
    }

    const fileFilter = isVideo ? isUploadableVideo : isImageFile
    const loadableKind = isVideo ? 'video' : 'image'
    function isLoadableOutput({ filename, media_kind }: DraggedAssetInfo) {
      const kind = media_kind ?? getMediaTypeFromFilename(filename)
      return kind === 'other' || kind === loadableKind
    }
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

    let rollback: (() => void) | undefined
    const { openFileSelection } = useNodeImageUpload(node, {
      allow_batch,
      fileFilter,
      resultItemFilter: isLoadableOutput,
      accept,
      folder,
      onReject: isVideo ? alertExtensionlessVideo : undefined,
      onUploadStart: (files) => {
        if (files.length > 0) {
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

        const newValue = allow_batch ? annotated : annotated[0]
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

    fileComboWidget.callback = function () {
      node.imgs = undefined
      nodeOutputStore.setNodeOutputs(node, String(fileComboWidget.value), {
        isAnimated
      })
      showCanvasPreview()
      node.graph?.setDirtyCanvas(true)
    }

    requestAnimationFrame(() => {
      const fileValue = fileComboWidget.value as
        | string
        | number
        | null
        | undefined
      if (fileValue != null) {
        nodeOutputStore.setNodeOutputs(node, String(fileValue), {
          isAnimated
        })
      }
      showCanvasPreview()
    })

    return { widget: uploadWidget }
  }

  return widgetConstructor
}
