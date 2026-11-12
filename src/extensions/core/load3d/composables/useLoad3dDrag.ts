import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isSupportedModelFilename } from '@/extensions/core/load3d/supportedModelFile'
import { t } from '@/i18n'
import { useToast } from '@/components/ui/toast/toastStore'

interface UseLoad3dDragOptions {
  onModelDrop: (file: File) => void | Promise<void>
  disabled?: MaybeRefOrGetter<boolean>
}

export function useLoad3dDrag(options: UseLoad3dDragOptions) {
  const isDragging = ref(false)
  const dragMessage = ref('')

  const isDisabled = computed(() => toValue(options.disabled) ?? false)

  function claimFileDrag(event: DragEvent): DataTransfer | null {
    const { dataTransfer } = event
    const carriesFiles = !!dataTransfer?.types.includes('Files')
    if (isDisabled.value || carriesFiles) {
      event.preventDefault()
      event.stopPropagation()
    }
    return isDisabled.value || !carriesFiles ? null : dataTransfer
  }

  function handleDragOver(event: DragEvent) {
    const dataTransfer = claimFileDrag(event)
    if (!dataTransfer) return

    isDragging.value = true
    dataTransfer.dropEffect = 'copy'
    dragMessage.value = t('load3d.dropToLoad')
  }

  function handleDragLeave() {
    isDragging.value = false
  }

  async function handleDrop(event: DragEvent) {
    isDragging.value = false

    const dataTransfer = claimFileDrag(event)
    if (!dataTransfer) return

    const files = Array.from(dataTransfer.files)

    if (files.length === 0) return

    const modelFile = files.find((file) => isSupportedModelFilename(file.name))

    if (modelFile) {
      await options.onModelDrop(modelFile)
    } else {
      useToast().warning(t('load3d.unsupportedFileType'))
    }
  }

  return {
    isDragging,
    dragMessage,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
