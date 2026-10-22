<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-muted-foreground">
      {{ t('maskEditor.layers') }}
    </h3>

    <SliderField
      :label="t('maskEditor.maskOpacity')"
      :model-value="maskOpacityPercent"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      :disabled="store.maskBlendMode === MaskBlendMode.Negative"
      @update:model-value="onMaskOpacityChange"
    />

    <div class="flex items-center justify-between gap-2">
      <span
        id="mask-blend-mode-label"
        class="text-left font-sans text-xs text-muted-foreground"
      >
        {{ t('maskEditor.maskBlendingOptions') }}
      </span>
      <Menu
        v-model:open="blendMenuOpen"
        :modal="false"
        :items="blendModeMenuItems"
        align="end"
      >
        <template #trigger>
          <Button
            variant="secondary"
            size="sm"
            class="gap-1"
            aria-labelledby="mask-blend-mode-label mask-blend-mode-value"
          >
            <span id="mask-blend-mode-value">
              {{ blendModeLabels[store.maskBlendMode] }}
            </span>
            <i
              class="icon-[lucide--chevron-down] size-3.5"
              aria-hidden="true"
            />
          </Button>
        </template>
      </Menu>
    </div>

    <div class="flex flex-col gap-1.5">
      <span class="text-left font-sans text-xs text-muted-foreground">
        {{ t('maskEditor.maskLayer') }}
      </span>
      <div
        :class="
          cn(
            'relative flex h-[50px] min-h-6 w-full items-center gap-2.5 rounded-[10px] bg-accent',
            store.activeLayer === 'mask' &&
              'border-2 border-solid border-primary'
          )
        "
      >
        <input
          type="checkbox"
          class="ml-4"
          :checked="maskLayerVisible"
          :aria-label="t('maskEditor.maskLayer')"
          @click.stop
          @change="onMaskLayerVisibilityChange"
        />
        <div class="h-[30px] w-10">
          <svg viewBox="0 0 20 20" class="size-full fill-foreground">
            <path
              d="M1.31,5.32v9.36c0,.55.45,1,1,1h15.38c.55,0,1-.45,1-1V5.32c0-.55-.45-1-1-1H2.31c-.55,0-1,.45-1,1ZM11.19,13.44c-2.91.94-5.57-1.72-4.63-4.63.34-1.05,1.19-1.9,2.24-2.24,2.91-.94,5.57,1.72,4.63,4.63-.34,1.05-1.19,1.9-2.24,2.24Z"
            />
          </svg>
        </div>
        <button
          type="button"
          class="text-xs"
          :class="store.activeLayer === 'mask' && 'opacity-50'"
          :disabled="store.activeLayer === 'mask'"
          @click="setActiveLayer('mask')"
        >
          {{ t('maskEditor.activateLayer') }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <span class="text-left font-sans text-xs text-muted-foreground">
        {{ t('maskEditor.paintLayer') }}
      </span>
      <div
        :class="
          cn(
            'relative flex h-[50px] min-h-6 w-full items-center gap-2.5 rounded-[10px] bg-accent',
            store.activeLayer === 'rgb' &&
              'border-2 border-solid border-primary'
          )
        "
      >
        <input
          type="checkbox"
          class="ml-4"
          :checked="paintLayerVisible"
          :aria-label="t('maskEditor.paintLayer')"
          @click.stop
          @change="onPaintLayerVisibilityChange"
        />
        <div class="h-[30px] w-10">
          <svg viewBox="0 0 20 20" class="size-full fill-foreground">
            <path
              d="M 17 6.965 c 0 0.235 -0.095 0.47 -0.275 0.655 l -6.51 6.52 c -0.045 0.035 -0.09 0.075 -0.135 0.11 c -0.035 -0.695 -0.605 -1.24 -1.305 -1.245 c 0.035 -0.06 0.08 -0.12 0.135 -0.17 l 6.52 -6.52 c 0.36 -0.36 0.945 -0.36 1.3 0 c 0.175 0.175 0.275 0.415 0.275 0.65 Z"
            />
            <path
              d="M 9.82 14.515 c 0 2.23 -3.23 1.59 -4.82 0 c 1.65 -0.235 2.375 -1.29 3.53 -1.29 c 0.715 0 1.29 0.58 1.29 1.29 Z"
            />
          </svg>
        </div>
        <button
          v-if="showLayerButtons"
          type="button"
          class="text-xs"
          :class="store.activeLayer === 'rgb' && 'opacity-50'"
          :disabled="store.activeLayer === 'rgb'"
          @click="setActiveLayer('rgb')"
        >
          {{ t('maskEditor.activateLayer') }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <span class="text-left font-sans text-xs text-muted-foreground">
        {{ t('maskEditor.baseImageLayer') }}
      </span>
      <div
        class="relative flex h-[50px] min-h-6 w-full items-center gap-2.5 rounded-[10px] bg-accent"
      >
        <input
          type="checkbox"
          class="ml-4"
          :checked="baseImageLayerVisible"
          :aria-label="t('maskEditor.baseImageLayer')"
          @change="onBaseImageLayerVisibilityChange"
        />
        <div class="h-[30px] w-10">
          <img
            class="size-full object-contain"
            :src="baseImageSrc"
            :alt="t('maskEditor.baseLayerPreview')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { useCanvasManager } from '@comfyorg/mask-editor/useCanvasManager'
import type { useToolManager } from '@comfyorg/mask-editor/useToolManager'
import type { ImageLayer } from '@comfyorg/mask-editor/types'
import { MaskBlendMode, Tools } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { cn } from '@comfyorg/tailwind-utils'

import SliderField from './controls/SliderField.vue'

const { toolManager } = defineProps<{
  toolManager?: ReturnType<typeof useToolManager>
}>()

const { t } = useI18n()
const store = useMaskEditorStore()
const canvasManager = useCanvasManager()
const blendMenuOpen = ref(false)

const maskLayerVisible = ref(true)
const paintLayerVisible = ref(true)
const baseImageLayerVisible = ref(true)

const baseImageSrc = computed(() => store.image?.src ?? '')

const showLayerButtons = computed(() => store.currentTool === Tools.Eraser)

const maskOpacityPercent = computed(() => Math.round(store.maskOpacity * 100))

const blendModeLabels = computed(
  (): Record<MaskBlendMode, string> => ({
    [MaskBlendMode.Black]: t('maskEditor.black'),
    [MaskBlendMode.White]: t('maskEditor.white'),
    [MaskBlendMode.Negative]: t('maskEditor.negative')
  })
)

const blendModeMenuItems = computed<MenuItem[]>(() =>
  (Object.values(MaskBlendMode) as MaskBlendMode[]).map((mode) => ({
    key: mode,
    label: blendModeLabels.value[mode],
    checked: store.maskBlendMode === mode,
    command: () => {
      void onBlendModeSelect(mode)
    }
  }))
)

function applyMaskCanvasOpacity() {
  const maskCanvas = store.maskCanvas
  if (!maskCanvas || store.maskBlendMode === MaskBlendMode.Negative) return
  maskCanvas.style.opacity = maskLayerVisible.value
    ? String(store.maskOpacity)
    : '0'
}

function onMaskLayerVisibilityChange(event: Event) {
  maskLayerVisible.value = (event.target as HTMLInputElement).checked
  applyMaskCanvasOpacity()
}

function onPaintLayerVisibilityChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  paintLayerVisible.value = checked
  const rgbCanvas = store.rgbCanvas
  if (rgbCanvas) rgbCanvas.style.opacity = checked ? '1' : '0'
}

function onBaseImageLayerVisibilityChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  baseImageLayerVisible.value = checked
  const imgCanvas = store.imgCanvas
  if (imgCanvas) imgCanvas.style.opacity = checked ? '1' : '0'
}

function onMaskOpacityChange(percent: number) {
  const opacity = Math.min(100, Math.max(0, percent)) / 100
  store.setMaskOpacity(opacity)
  maskLayerVisible.value = opacity !== 0
  applyMaskCanvasOpacity()
}

async function onBlendModeSelect(mode: MaskBlendMode) {
  store.maskBlendMode = mode
  await canvasManager.updateMaskColor()
  applyMaskCanvasOpacity()
}

function setActiveLayer(layer: ImageLayer) {
  toolManager?.setActiveLayer(layer)
}
</script>
