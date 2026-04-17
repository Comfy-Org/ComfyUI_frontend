<template>
  <div class="relative">
    <Button
      v-tooltip.top="{
        value: localizedCurrentColorName ?? t('color.noColor'),
        showDelay: 1000
      }"
      data-testid="color-picker-button"
      variant="muted-textonly"
      :aria-label="t('g.color')"
      @click="() => (showColorPicker = !showColorPicker)"
    >
      <div class="flex items-center gap-1 px-0">
        <i
          class="pi pi-circle-fill"
          data-testid="color-picker-current-color"
          :style="{ color: currentColor ?? '' }"
        />
        <i class="icon-[lucide--chevron-down]" />
      </div>
    </Button>
    <div
      v-if="showColorPicker"
      class="absolute -top-10 left-1/2 z-10 min-w-44 -translate-x-1/2 rounded-lg border border-border-default bg-interface-panel-surface p-2 shadow-lg"
    >
      <SelectButton
        :model-value="selectedColorOption"
        :options="colorOptions"
        option-label="name"
        data-key="value"
        @update:model-value="applyColor"
      >
        <template #option="{ option }">
          <i
            v-tooltip.top="option.localizedName"
            class="pi pi-circle-fill"
            :style="{
              color: isLightTheme ? option.value.light : option.value.dark
            }"
            :data-testid="option.name"
          />
        </template>
      </SelectButton>
      <div class="mt-2 flex items-center gap-2">
        <ColorPicker
          data-testid="custom-color-trigger"
          :model-value="currentPickerValue"
          format="hex"
          :aria-label="t('g.custom')"
          class="h-8 w-8 overflow-hidden rounded-md border border-border-default bg-secondary-background"
          :pt="{
            preview: {
              class: '!h-full !w-full !rounded-md !border-none'
            }
          }"
          @update:model-value="onCustomColorUpdate"
        />
        <button
          class="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border-default bg-secondary-background hover:bg-secondary-background-hover disabled:cursor-not-allowed disabled:opacity-50"
          :title="isCurrentColorFavorite ? t('g.remove') : t('g.favorites')"
          data-testid="toggle-favorite-color"
          :disabled="!currentAppliedColor"
          @click="toggleCurrentColorFavorite"
        >
          <i
            :class="
              isCurrentColorFavorite
                ? 'icon-[lucide--star] text-yellow-500'
                : 'icon-[lucide--star-off]'
            "
          />
        </button>
      </div>
      <div v-if="favoriteColors.length" class="mt-2 flex flex-wrap gap-1">
        <button
          v-for="color in favoriteColors"
          :key="`favorite-${color}`"
          class="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border-default bg-secondary-background hover:bg-secondary-background-hover"
          :title="`${t('g.favorites')}: ${color.toUpperCase()}`"
          @click="applySavedCustomColor(color)"
        >
          <div
            class="size-4 rounded-full border border-border-default"
            :style="{ backgroundColor: color }"
          />
        </button>
      </div>
      <div v-if="recentColors.length" class="mt-2 flex flex-wrap gap-1">
        <button
          v-for="color in recentColors"
          :key="`recent-${color}`"
          class="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border-default bg-secondary-background hover:bg-secondary-background-hover"
          :title="`${t('modelLibrary.sortRecent')}: ${color.toUpperCase()}`"
          @click="applySavedCustomColor(color)"
        >
          <div
            class="size-4 rounded-full border border-border-default"
            :style="{ backgroundColor: color }"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ColorPicker from 'primevue/colorpicker'
import SelectButton from 'primevue/selectbutton'
import type { Raw } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type {
  ColorOption as CanvasColorOption,
  Positionable
} from '@/lib/litegraph/src/litegraph'
import {
  LGraphCanvas,
  LiteGraph,
  isColorable
} from '@/lib/litegraph/src/litegraph'
import { useCustomNodeColorSettings } from '@/composables/graph/useCustomNodeColorSettings'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor, toHexFromFormat } from '@/utils/colorUtil'
import { getItemsColorOption } from '@/utils/litegraphUtil'
import { getDefaultCustomNodeColor } from '@/utils/nodeColorCustomization'

const { t } = useI18n()
const canvasStore = useCanvasStore()
const colorPaletteStore = useColorPaletteStore()
const workflowStore = useWorkflowStore()
const { applyCustomColor, getCurrentAppliedColor } = useNodeCustomization()
const {
  favoriteColors,
  recentColors,
  isFavoriteColor,
  toggleFavoriteColor
} = useCustomNodeColorSettings()
const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)
const toLightThemeColor = (color: string) =>
  adjustColor(color, { lightness: 0.5 })

const showColorPicker = ref(false)

type ColorOption = {
  name: string
  localizedName: string
  value: {
    dark: string
    light: string
  }
}

const NO_COLOR_OPTION: ColorOption = {
  name: 'noColor',
  localizedName: t('color.noColor'),
  value: {
    dark: LiteGraph.NODE_DEFAULT_BGCOLOR,
    light: toLightThemeColor(LiteGraph.NODE_DEFAULT_BGCOLOR)
  }
}
const colorOptions: ColorOption[] = [
  NO_COLOR_OPTION,
  ...Object.entries(LGraphCanvas.node_colors).map(([name, color]) => ({
    name,
    localizedName: t(`color.${name}`),
    value: {
      dark: color.bgcolor,
      light: toLightThemeColor(color.bgcolor)
    }
  }))
]

const selectedColorOption = ref<ColorOption | null>(null)
const applyColor = (colorOption: ColorOption | null) => {
  const colorName = colorOption?.name ?? NO_COLOR_OPTION.name
  const canvasColorOption =
    colorName === NO_COLOR_OPTION.name
      ? null
      : LGraphCanvas.node_colors[colorName]

  for (const item of canvasStore.selectedItems) {
    if (isColorable(item)) {
      item.setColorOption(canvasColorOption)
    }
  }

  canvasStore.canvas?.setDirty(true, true)
  currentColorOption.value = canvasColorOption
  showColorPicker.value = false
  workflowStore.activeWorkflow?.changeTracker?.captureCanvasState()
}

const currentColorOption = ref<CanvasColorOption | null>(null)
const currentAppliedColor = computed(() => getCurrentAppliedColor())
const currentPickerValue = computed(() =>
  (currentAppliedColor.value ?? getDefaultCustomNodeColor()).replace('#', '')
)
const currentColor = computed(() =>
  currentColorOption.value
    ? isLightTheme.value
      ? toLightThemeColor(currentColorOption.value?.bgcolor)
      : currentColorOption.value?.bgcolor
    : currentAppliedColor.value
)

const localizedCurrentColorName = computed(() => {
  if (currentAppliedColor.value) {
    return currentAppliedColor.value.toUpperCase()
  }
  if (!currentColorOption.value?.bgcolor) {
    return null
  }
  const colorOption = colorOptions.find(
    (option) =>
      option.value.dark === currentColorOption.value?.bgcolor ||
      option.value.light === currentColorOption.value?.bgcolor
  )
  return colorOption?.localizedName ?? NO_COLOR_OPTION.localizedName
})

async function applySavedCustomColor(color: string) {
  currentColorOption.value = null
  await applyCustomColor(color)
  showColorPicker.value = false
}

async function onCustomColorUpdate(value: string) {
  await applySavedCustomColor(toHexFromFormat(value, 'hex'))
}

async function toggleCurrentColorFavorite() {
  if (!currentAppliedColor.value) return
  await toggleFavoriteColor(currentAppliedColor.value)
}

const isCurrentColorFavorite = computed(() =>
  isFavoriteColor(currentAppliedColor.value)
)

const updateColorSelectionFromNode = (
  newSelectedItems: Raw<Positionable[]>
) => {
  showColorPicker.value = false
  selectedColorOption.value = null
  currentColorOption.value = getItemsColorOption(newSelectedItems)
}
watch(
  () => canvasStore.selectedItems,
  (newSelectedItems) => {
    updateColorSelectionFromNode(newSelectedItems)
  },
  { immediate: true }
)
</script>

<style scoped>
:deep(.p-togglebutton) {
  padding: calc(var(--spacing) * 2) var(--spacing);
}
</style>
