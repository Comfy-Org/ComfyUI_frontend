import { toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { ServerFeatureFlag } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { ResultItemType } from '@/schemas/resultItemTypeSchema'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const BYTES_PER_MB = 1024 * 1024

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

interface UseWidgetSelectActionsOptions {
  modelValue: Ref<string | undefined>
  dropdownItems: MaybeRefOrGetter<readonly FormDropdownItem[]>
  widget: MaybeRefOrGetter<SimplifiedWidget<string | undefined>>
  uploadFolder: MaybeRefOrGetter<ResultItemType | undefined>
  uploadSubfolder: MaybeRefOrGetter<string | undefined>
}

export function useWidgetSelectActions(options: UseWidgetSelectActionsOptions) {
  const { modelValue, dropdownItems } = options
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  function updateSelectedItems(selectedItems: Set<string>) {
    const id =
      selectedItems.size > 0 ? selectedItems.values().next().value : undefined
    const name =
      id == null
        ? undefined
        : toValue(dropdownItems).find((item) => item.id === id)?.name

    modelValue.value = name
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
      toastStore.addAlert(buildUploadErrorMessage(resp))
      return null
    }

    const data = await resp.json()

    if (formFields.type === 'input' || (!formFields.type && !isPasted)) {
      await useAssetsStore().inputAssets.invalidate()
    }

    return data.subfolder ? `${data.subfolder}/${data.name}` : data.name
  }

  async function uploadFiles(files: File[]): Promise<string[]> {
    const folder = toValue(options.uploadFolder) ?? 'input'
    const uploadPromises = files.map((file) =>
      uploadFile(file, false, { type: folder })
    )
    const results = await Promise.all(uploadPromises)
    return results.filter((path): path is string => path !== null)
  }

  const handleFilesUpdate = wrapWithErrorHandlingAsync(
    async (files: File[]) => {
      if (files.length === 0) return

      const uploadedPaths = await uploadFiles(files)

      if (uploadedPaths.length === 0) {
        toastStore.addAlert('File upload failed')
        return
      }

      const widget = toValue(options.widget)
      const values = widget.options?.values
      if (Array.isArray(values)) {
        uploadedPaths.forEach((path) => {
          if (!values.includes(path)) {
            values.push(path)
          }
        })
      }

      modelValue.value = uploadedPaths[0]

      if (widget.callback) {
        widget.callback(uploadedPaths[0])
      }

      useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
    }
  )

  return {
    updateSelectedItems,
    handleFilesUpdate
  }
}
