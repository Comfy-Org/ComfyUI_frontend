import { toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { UPLOAD_SKIPPED_ERROR, useUpload } from '@/composables/useUpload'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { ResultItemType } from '@/schemas/apiSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

interface UseWidgetSelectActionsOptions {
  modelValue: Ref<string | undefined>
  dropdownItems: ComputedRef<FormDropdownItem[]>
  widget: MaybeRefOrGetter<SimplifiedWidget<string | undefined>>
  uploadFolder: MaybeRefOrGetter<ResultItemType | undefined>
  uploadSubfolder: MaybeRefOrGetter<string | undefined>
}

export function useWidgetSelectActions(options: UseWidgetSelectActionsOptions) {
  const { modelValue, dropdownItems } = options
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()
  const { loading, uploadBatch } = useUpload()

  function updateSelectedItems(selectedItems: Set<string>) {
    const id =
      selectedItems.size > 0 ? selectedItems.values().next().value : undefined
    const name =
      id == null
        ? undefined
        : dropdownItems.value.find((item) => item.id === id)?.name

    modelValue.value = name
    useWorkflowStore().activeWorkflow?.changeTracker?.captureCanvasState()
  }

  async function uploadFiles(files: File[]): Promise<string[]> {
    const folder = toValue(options.uploadFolder) ?? 'input'
    const subfolder = toValue(options.uploadSubfolder) ?? undefined

    const results = await uploadBatch(
      files.map((file) => ({ source: file })),
      { subfolder, type: folder }
    )

    const skipped = results.some((r) => r.error === UPLOAD_SKIPPED_ERROR)
    if (skipped) {
      toastStore.addAlert(t('g.uploadAlreadyInProgress'))
      return []
    }

    const uploadedPaths: string[] = []
    for (const result of results) {
      if (!result.success) {
        toastStore.addAlert(result.error ?? t('toastMessages.uploadFailed'))
        continue
      }
      uploadedPaths.push(result.path)
    }

    if (uploadedPaths.length > 0 && folder === 'input') {
      await useAssetsStore().updateInputs()
    }

    return uploadedPaths
  }

  const handleFilesUpdate = wrapWithErrorHandlingAsync(
    async (files: File[]) => {
      if (!files || files.length === 0) return

      const uploadedPaths = await uploadFiles(files)

      if (uploadedPaths.length === 0) {
        toastStore.addAlert(t('toastMessages.fileUploadFailed'))
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

      useWorkflowStore().activeWorkflow?.changeTracker?.captureCanvasState()
    }
  )

  return {
    updateSelectedItems,
    handleFilesUpdate,
    loading
  }
}
