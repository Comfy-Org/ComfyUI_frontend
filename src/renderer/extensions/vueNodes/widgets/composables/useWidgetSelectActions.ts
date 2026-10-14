import { toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { UploadImageResponse } from '@comfyorg/ingest-types'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { resolveWidgetValueAsset } from '@/platform/assets/utils/resolveWidgetValueAsset'
import type { ResultItem } from '@/platform/remote/comfyui/execution/types'
import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { ResultItemType } from '@/schemas/resultItemTypeSchema'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'
import { isExtensionlessVideo } from '@/utils/mediaUploadUtil'
import { isResultItemType } from '@/utils/typeGuardUtil'

const BYTES_PER_MB = 1024 * 1024
interface UploadResponse extends UploadImageResponse {
  asset?: { preview_id?: string }
}

function buildUploadErrorMessage(resp: Response) {
  if (resp.status === 413) {
    const maxUploadSize = api.getServerFeature<number>(
      ServerFeatureFlag.MAX_UPLOAD_SIZE
    )
    return typeof maxUploadSize === 'number' && maxUploadSize > 0
      ? t('g.uploadFileTooLargeWithLimit', {
          limit: Math.round(maxUploadSize / BYTES_PER_MB)
        })
      : t('g.uploadFileTooLarge')
  }

  return t('g.uploadFailed', {
    reason: resp.statusText || `HTTP ${resp.status}`
  })
}

function toUploadedPath({ subfolder, name }: UploadResponse) {
  return subfolder ? `${subfolder}/${name}` : name
}

function addMissingOptionValues(
  widget: SimplifiedWidget<string | undefined>,
  paths: (string | undefined)[]
) {
  const values = widget.options?.values
  if (!Array.isArray(values)) return
  for (const path of paths) if (!values.includes(path)) values.push(path)
}

interface UseWidgetSelectActionsOptions {
  modelValue: Ref<string | undefined>
  dropdownItems: MaybeRefOrGetter<readonly FormDropdownItem[]>
  widget: MaybeRefOrGetter<SimplifiedWidget<string | undefined>>
  uploadFolder: MaybeRefOrGetter<ResultItemType | undefined>
  uploadSubfolder: MaybeRefOrGetter<string | undefined>
  locatorId?: MaybeRefOrGetter<NodeLocatorId | undefined>
}

export function useWidgetSelectActions(options: UseWidgetSelectActionsOptions) {
  const { modelValue, dropdownItems } = options
  const toast = useToast()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  function setPreviewImage(image: ResultItem) {
    const locatorId = toValue(options.locatorId)
    if (locatorId)
      useNodeOutputStore().nodeOutputs[locatorId] = { images: [image] }
  }

  const showHdrPreviewIfApplicable = wrapWithErrorHandlingAsync(
    async (widgetValue: string | undefined) => {
      if (!widgetValue) return

      const { filepath, rootFolder } = parseAnnotatedPath(widgetValue)
      if (!isHdrImageFilename(filepath)) return

      const asset = await resolveWidgetValueAsset(widgetValue)
      if (!asset?.preview_id || modelValue.value !== widgetValue) return

      const separatorIndex = filepath.lastIndexOf('/')
      setPreviewImage({
        filename: filepath.slice(separatorIndex + 1),
        preview_id: asset.preview_id,
        subfolder: filepath.slice(0, Math.max(separatorIndex, 0)),
        type: isResultItemType(rootFolder) ? rootFolder : undefined
      })
    }
  )

  void showHdrPreviewIfApplicable(modelValue.value)

  function updateSelectedItems(selectedItems: Set<string>) {
    const id =
      selectedItems.size > 0 ? selectedItems.values().next().value : undefined
    const name =
      id == null
        ? undefined
        : toValue(dropdownItems).find((item) => item.id === id)?.name

    modelValue.value = name
    void showHdrPreviewIfApplicable(name)
    useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  }

  async function uploadFile(
    file: File,
    isPasted: boolean = false,
    formFields: Partial<{ type: ResultItemType }> = {}
  ) {
    const body = new FormData()
    body.append('image', file)
    if (isPasted) body.append('subfolder', 'pasted')
    else {
      const subfolder = toValue(options.uploadSubfolder)
      if (subfolder) body.append('subfolder', subfolder)
    }
    if (formFields.type) body.append('type', formFields.type)

    const resp = await api.fetchApi('/upload/image', {
      method: 'POST',
      body
    })

    if (resp.status !== 200) {
      toast.warning(buildUploadErrorMessage(resp))
      return null
    }

    const data: UploadResponse = await resp.json()

    if (formFields.type === 'input' || (!formFields.type && !isPasted)) {
      await useAssetsStore().inputAssets.invalidate()
    }

    return data
  }

  async function uploadFiles(files: File[]): Promise<UploadResponse[]> {
    const folder = toValue(options.uploadFolder) ?? 'input'
    const uploadPromises = files.map((file) =>
      uploadFile(file, false, { type: folder })
    )
    return (await Promise.all(uploadPromises)).filter((data) => !!data)
  }

  function showUploadPreview(upload: UploadResponse) {
    if (!upload.asset?.preview_id) return
    setPreviewImage({
      filename: upload.name,
      preview_id: upload.asset.preview_id,
      subfolder: upload.subfolder,
      type: isResultItemType(upload.type) ? upload.type : undefined
    })
  }

  const handleFilesUpdate = wrapWithErrorHandlingAsync(
    async (files: File[]) => {
      if (files.length === 0) return
      if (files.some(isExtensionlessVideo)) {
        toast.warning(t('g.videoFilenameExtensionRequired'))
        return
      }

      const uploadedResponses = await uploadFiles(files)
      const uploadedPaths = uploadedResponses.map(toUploadedPath)

      if (uploadedPaths.length === 0) {
        toast.warning(t('toastMessages.fileUploadFailed'))
        return
      }

      const widget = toValue(options.widget)
      addMissingOptionValues(widget, uploadedPaths)
      modelValue.value = uploadedPaths[0]
      widget.callback?.(uploadedPaths[0])
      showUploadPreview(uploadedResponses[0])

      useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
    }
  )

  return {
    updateSelectedItems,
    handleFilesUpdate
  }
}
