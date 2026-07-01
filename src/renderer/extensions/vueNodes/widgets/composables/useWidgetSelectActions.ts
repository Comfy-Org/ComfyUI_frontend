import { toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { uploadMedia } from '@/platform/assets/services/uploadService'
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

  async function uploadFile(
    file: File,
    isPasted: boolean = false,
    formFields: Partial<{ type: ResultItemType }> = {}
  ) {
    const subfolder = isPasted
      ? 'pasted'
      : (toValue(options.uploadSubfolder) ?? undefined)

    const result = await uploadMedia(
      { source: file },
      { subfolder, type: formFields.type }
    )

    if (!result.success) {
      toastStore.addAlert(result.error ?? t('toastMessages.uploadFailed'))
      return null
    }

    if (formFields.type === 'input' || (!formFields.type && !isPasted)) {
      const assetsStore = useAssetsStore()
      await assetsStore.updateInputs()
    }

    return result.path
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
    handleFilesUpdate
  }
}
