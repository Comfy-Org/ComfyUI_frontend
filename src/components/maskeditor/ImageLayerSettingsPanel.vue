<template>
  <div class="flex flex-col gap-3 pb-3">
    <div class="mt-2.5 flex items-center justify-between gap-2">
      <h3 class="text-descrip-text text-center font-sans text-[15px]">
        {{ t('maskEditor.layerSettings') }}
      </h3>
    </div>

    <div class="flex items-center gap-2">
      <DropdownMenuRoot
        v-model:open="blendModeDropdownOpen"
        :modal="false"
        class="flex-1"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border-default bg-secondary-background px-2 text-sm transition-colors duration-100 hover:bg-secondary-background-hover"
          >
            <span>{{ blendModeLabels[store.maskBlendMode] }}</span>
            <i
              class="icon-[lucide--chevron-down] size-3 text-muted-foreground"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal to="body">
          <DropdownMenuContent
            align="start"
            :side-offset="5"
            :collision-padding="10"
            class="z-2102 min-w-40 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
          >
            <WorkflowActionsList :items="blendModeMenuItems" />
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <DropdownMenuRoot v-model:open="opacityDropdownOpen" :modal="false">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex h-8 w-20 items-center justify-between gap-2 rounded-lg border border-border-default bg-secondary-background px-2 text-sm transition-colors duration-100 hover:bg-secondary-background-hover"
          >
            <span>{{ Math.round(store.maskOpacity * 100) }}%</span>
            <i
              class="icon-[lucide--chevron-down] size-3 text-muted-foreground"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal to="body">
          <DropdownMenuContent
            align="start"
            :side-offset="5"
            :collision-padding="10"
            class="z-2102 rounded-lg border border-border-subtle bg-base-background px-3 py-4 shadow-interface"
          >
            <div class="flex w-48 flex-col gap-3">
              <span class="text-left font-sans text-xs text-(--descrip-text)">
                {{ t('maskEditor.maskOpacity') }}
              </span>
              <Slider
                :model-value="store.maskOpacity"
                class="my-1 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
                :min="0"
                :max="1"
                :step="0.01"
                @update:model-value="onMaskOpacityChange"
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>

    <span class="text-left font-sans text-xs text-(--descrip-text)">{{
      t('maskEditor.maskLayer')
    }}</span>
    <div
      class="relative flex h-[50px] min-h-6 w-full cursor-pointer flex-row items-center gap-2.5 rounded-[10px] bg-secondary-background-hover"
      :style="{
        border: store.activeLayer === 'mask' ? '2px solid #007acc' : 'none'
      }"
      @click="setActiveLayer('mask')"
    >
      <input
        type="checkbox"
        class="maskEditor_sidePanelLayerCheckbox"
        :checked="maskLayerVisible"
        @change="onMaskLayerVisibilityChange"
      />
      <div class="maskEditor_sidePanelLayerPreviewContainer">
        <svg viewBox="0 0 20 20" style="">
          <path
            class="cls-1"
            d="M1.31,5.32v9.36c0,.55.45,1,1,1h15.38c.55,0,1-.45,1-1V5.32c0-.55-.45-1-1-1H2.31c-.55,0-1,.45-1,1ZM11.19,13.44c-2.91.94-5.57-1.72-4.63-4.63.34-1.05,1.19-1.9,2.24-2.24,2.91-.94,5.57,1.72,4.63,4.63-.34,1.05-1.19-1.9-2.24,2.24Z"
          />
        </svg>
      </div>
    </div>

    <span class="text-left font-sans text-xs text-(--descrip-text)">{{
      t('maskEditor.paintLayer')
    }}</span>
    <div
      class="relative flex h-[50px] min-h-6 w-full cursor-pointer flex-row items-center gap-2.5 rounded-[10px] bg-secondary-background-hover"
      :style="{
        border: store.activeLayer === 'rgb' ? '2px solid #007acc' : 'none'
      }"
      @click="setActiveLayer('rgb')"
    >
      <input
        type="checkbox"
        class="maskEditor_sidePanelLayerCheckbox"
        :checked="paintLayerVisible"
        @change="onPaintLayerVisibilityChange"
      />
      <div class="maskEditor_sidePanelLayerPreviewContainer">
        <svg viewBox="0 0 20 20">
          <path
            class="cls-1"
            d="M 17 6.965 c 0 0.235 -0.095 0.47 -0.275 0.655 l -6.51 6.52 c -0.045 0.035 -0.09 0.075 -0.135 0.11 c -0.035 -0.695 -0.605 -1.24 -1.305 -1.245 c 0.035 -0.06 0.08 -0.12 0.135 -0.17 l 6.52 -6.52 c 0.36 -0.36 0.945 -0.36 1.3 0 c 0.175 0.175 0.275 0.415 0.275 0.65 Z"
          />
          <path
            class="cls-1"
            d="M 9.82 14.515 c 0 2.23 -3.23 1.59 -4.82 0 c 1.65 -0.235 2.375 -1.29 3.53 -1.29 c 0.715 0 1.29 0.58 1.29 1.29 Z"
          />
        </svg>
      </div>
    </div>

    <span class="text-left font-sans text-xs text-(--descrip-text)">{{
      t('maskEditor.baseImageLayer')
    }}</span>
    <div
      class="relative flex h-[50px] min-h-6 w-full flex-row items-center gap-2.5 rounded-[10px] bg-secondary-background-hover"
    >
      <input
        type="checkbox"
        class="maskEditor_sidePanelLayerCheckbox"
        :checked="baseImageLayerVisible"
        @change="onBaseImageLayerVisibilityChange"
      />
      <div class="maskEditor_sidePanelLayerPreviewContainer">
        <img
          class="maskEditor_sidePanelImageLayerImage"
          :src="baseImageSrc"
          :alt="t('maskEditor.baseLayerPreview')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Slider from 'primevue/slider'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import { useCanvasManager } from '@/composables/maskeditor/useCanvasManager'
import type { useToolManager } from '@/composables/maskeditor/useToolManager'
import type { ImageLayer } from '@/extensions/core/maskeditor/types'
import { MaskBlendMode } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const { toolManager } = defineProps<{
  toolManager?: ReturnType<typeof useToolManager>
}>()

const { t } = useI18n()
const store = useMaskEditorStore()
const canvasManager = useCanvasManager()

const blendModeDropdownOpen = ref(false)
const opacityDropdownOpen = ref(false)
const maskLayerVisible = ref(true)
const paintLayerVisible = ref(true)
const baseImageLayerVisible = ref(true)

const blendModeLabels: Record<MaskBlendMode, string> = {
  [MaskBlendMode.Black]: t('maskEditor.black'),
  [MaskBlendMode.White]: t('maskEditor.white'),
  [MaskBlendMode.Negative]: t('maskEditor.negative')
}

const blendModeOptions = [
  { id: MaskBlendMode.Black, label: t('maskEditor.black') },
  { id: MaskBlendMode.White, label: t('maskEditor.white') },
  { id: MaskBlendMode.Negative, label: t('maskEditor.negative') }
]

const blendModeMenuItems = blendModeOptions.map((option) => ({
  id: option.id,
  label: option.label,
  command: () => onBlendModeSelect(option.id)
}))

const onBlendModeSelect = async (blendMode: MaskBlendMode) => {
  store.maskBlendMode = blendMode
  blendModeDropdownOpen.value = false
  await canvasManager.updateMaskColor()
}

const baseImageSrc = computed(() => {
  return store.image?.src ?? ''
})

const onMaskLayerVisibilityChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  maskLayerVisible.value = checked

  const maskCanvas = store.maskCanvas
  if (maskCanvas) {
    maskCanvas.style.opacity = checked ? String(store.maskOpacity) : '0'
  }
}

const onPaintLayerVisibilityChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  paintLayerVisible.value = checked

  const rgbCanvas = store.rgbCanvas
  if (rgbCanvas) {
    rgbCanvas.style.opacity = checked ? '1' : '0'
  }
}

const onBaseImageLayerVisibilityChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  baseImageLayerVisible.value = checked

  const imgCanvas = store.imgCanvas
  if (imgCanvas) {
    imgCanvas.style.opacity = checked ? '1' : '0'
  }
}

const onMaskOpacityChange = (value: number | number[] | undefined) => {
  const numValue = Array.isArray(value) ? value[0] : (value ?? 0)
  store.setMaskOpacity(numValue)

  const maskCanvas = store.maskCanvas
  if (maskCanvas) {
    maskCanvas.style.opacity = String(numValue)
  }

  maskLayerVisible.value = numValue !== 0
}

const setActiveLayer = (layer: ImageLayer) => {
  toolManager?.setActiveLayer(layer)
}
</script>
