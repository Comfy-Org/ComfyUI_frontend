import { toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
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

  function captureWorkflowState() {
    useWorkflowStore().activeWorkflow?.changeTracker?.captureCanvasState()
  }

  function updateSelectedItems(selectedItems: Set<string>) {
    const id =
      selectedItems.size > 0 ? selectedItems.values().next().value : undefined
    const name =
      id == null
        ? undefined
        : dropdownItems.value.find((item) => item.id === id)?.name

    modelValue.value = name
    captureWorkflowState()
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
      toastStore.addAlert(resp.status + ' - ' + resp.statusText)
      return null
    }

    const data = await resp.json()

    if (formFields.type === 'input' || (!formFields.type && !isPasted)) {
      const assetsStore = useAssetsStore()
      await assetsStore.updateInputs()
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
      if (!files || files.length === 0) return

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

      captureWorkflowState()
    }
  )

  return {
    updateSelectedItems,
    handleFilesUpdate
  }
}
