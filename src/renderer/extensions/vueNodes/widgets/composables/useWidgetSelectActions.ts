import type { ComputedRef, Ref } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

export interface UseWidgetSelectActionsOptions {
  modelValue: Ref<string | undefined>
  dropdownItems: ComputedRef<FormDropdownItem[]>
  widget: () => SimplifiedWidget<string | undefined>
  uploadFolder: () => ResultItemType | undefined
  uploadSubfolder: () => string | undefined
}

export function useWidgetSelectActions(options: UseWidgetSelectActionsOptions) {
  const { modelValue, dropdownItems } = options
  const toastStore = useToastStore()

  function updateSelectedItems(selectedItems: Set<string>) {
    let id: string | undefined = undefined
    if (selectedItems.size > 0) {
      id = selectedItems.values().next().value!
    }
    if (id == null) {
      modelValue.value = undefined
      return
    }
    const name = dropdownItems.value.find((item) => item.id === id)?.name
    if (!name) {
      modelValue.value = undefined
      return
    }
    modelValue.value = name
    useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
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
      const subfolder = options.uploadSubfolder()
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
    const folder = options.uploadFolder() ?? 'input'
    const uploadPromises = files.map((file) =>
      uploadFile(file, false, { type: folder })
    )
    const results = await Promise.all(uploadPromises)
    return results.filter((path): path is string => path !== null)
  }

  async function handleFilesUpdate(files: File[]) {
    if (!files || files.length === 0) return

    try {
      const uploadedPaths = await uploadFiles(files)

      if (uploadedPaths.length === 0) {
        toastStore.addAlert('File upload failed')
        return
      }

      const widget = options.widget()
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

      useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
    } catch (error) {
      console.error('Upload error:', error)
      toastStore.addAlert(`Upload failed: ${error}`)
    }
  }

  return {
    updateSelectedItems,
    handleFilesUpdate
  }
}
