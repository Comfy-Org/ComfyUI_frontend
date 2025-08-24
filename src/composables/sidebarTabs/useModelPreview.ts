import { CSSProperties, computed, nextTick, ref } from 'vue'

import { ComfyModelDef } from '@/stores/modelStore'
import { useSettingStore } from '@/stores/settingStore'

export function useModelPreview<
  T extends { $el: HTMLElement } = { $el: HTMLElement }
>() {
  const isHovered = ref(false)
  const previewRef = ref<T | null>(null)
  const modelPreviewStyle = ref<CSSProperties>({
    position: 'absolute',
    top: '0px',
    left: '0px'
  })

  const settingStore = useSettingStore()
  const sidebarLocation = computed<'left' | 'right'>(() =>
    settingStore.get('Comfy.Sidebar.Location')
  )

  const shouldShowPreview = (modelDef: ComfyModelDef) => {
    return (
      isHovered.value &&
      modelDef &&
      modelDef.has_loaded_metadata &&
      (modelDef.author ||
        modelDef.simplified_file_name != modelDef.title ||
        modelDef.description ||
        modelDef.usage_hint ||
        modelDef.trigger_phrase ||
        modelDef.image)
    )
  }

  const handleModelHover = async (targetElement: HTMLElement) => {
    if (!targetElement) return

    const targetRect = targetElement.getBoundingClientRect()
    const previewHeight = previewRef.value?.$el?.offsetHeight || 0
    const availableSpaceBelow = window.innerHeight - targetRect.bottom

    modelPreviewStyle.value.top =
      previewHeight > availableSpaceBelow
        ? `${Math.max(0, targetRect.top - (previewHeight - availableSpaceBelow) - 20)}px`
        : `${targetRect.top - 40}px`

    if (sidebarLocation.value === 'left') {
      modelPreviewStyle.value.left = `${targetRect.right}px`
    } else {
      modelPreviewStyle.value.left = `${targetRect.left - 400}px`
    }
  }

  const handleMouseEnter = async (
    targetElement: HTMLElement,
    modelDef: ComfyModelDef
  ) => {
    isHovered.value = true
    await modelDef.load()
    await nextTick()
    await handleModelHover(targetElement)
  }

  const handleMouseLeave = () => {
    isHovered.value = false
  }

  return {
    isHovered,
    previewRef,
    modelPreviewStyle,
    shouldShowPreview,
    handleMouseEnter,
    handleMouseLeave
  }
}
