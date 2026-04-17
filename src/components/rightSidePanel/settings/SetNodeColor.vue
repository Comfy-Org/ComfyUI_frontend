<script setup lang="ts">
import ColorPicker from 'primevue/colorpicker'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  ColorOption,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { useCustomNodeColorSettings } from '@/composables/graph/useCustomNodeColorSettings'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'
import {
  applyCustomColorToItems,
  getDefaultCustomNodeColor,
  getSharedAppliedColor
} from '@/utils/nodeColorCustomization'
import { cn } from '@/utils/tailwindUtil'

import LayoutField from './LayoutField.vue'

/**
 * Good design limits dependencies and simplifies the interface of the abstraction layer.
 * Here, we only care about the getColorOption and setColorOption methods,
 * and do not concern ourselves with other methods.
 */
type PickedNode = LGraphNode | LGraphGroup

const { nodes } = defineProps<{ nodes: PickedNode[] }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const { t } = useI18n()

const colorPaletteStore = useColorPaletteStore()
const {
  darkerHeader,
  favoriteColors,
  isFavoriteColor,
  recentColors,
  rememberRecentColor,
  toggleFavoriteColor
} = useCustomNodeColorSettings()

type NodeColorOption = {
  name: string
  localizedName: () => string
  value: {
    dark: string
    light: string
    ringDark: string
    ringLight: string
  }
}

const nodeColorEntries = Object.entries(LGraphCanvas.node_colors)

function getColorValue(color: string): NodeColorOption['value'] {
  return {
    dark: adjustColor(color, { lightness: 0.3 }),
    light: adjustColor(color, { lightness: 0.4 }),
    ringDark: adjustColor(color, { lightness: 0.5 }),
    ringLight: adjustColor(color, { lightness: 0.1 })
  }
}

const NO_COLOR_OPTION: NodeColorOption = {
  name: 'noColor',
  localizedName: () => t('color.noColor'),
  value: getColorValue(LiteGraph.NODE_DEFAULT_BGCOLOR)
}

const colorOptions: NodeColorOption[] = [
  NO_COLOR_OPTION,
  ...nodeColorEntries.map(([name, color]) => ({
    name,
    localizedName: () => t(`color.${name}`),
    value: getColorValue(color.bgcolor)
  }))
]

const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)

const nodeColor = computed<NodeColorOption['name'] | null>({
  get() {
    if (nodes.length === 0) return null
    const theColorOptions = nodes.map((item) => item.getColorOption())

    let colorOption: ColorOption | null | false = theColorOptions[0]
    if (!theColorOptions.every((option) => option === colorOption)) {
      colorOption = false
    }

    if (colorOption === false) return null
    if (colorOption == null || (!colorOption.bgcolor && !colorOption.color))
      return NO_COLOR_OPTION.name
    return (
      nodeColorEntries.find(
        ([_, color]) =>
          color.bgcolor === colorOption.bgcolor &&
          color.color === colorOption.color
      )?.[0] ?? null
    )
  },
  set(colorName) {
    if (colorName === null) return

    const canvasColorOption =
      colorName === NO_COLOR_OPTION.name
        ? null
        : LGraphCanvas.node_colors[colorName]

    for (const item of nodes) {
      item.setColorOption(canvasColorOption)
    }

    emit('changed')
  }
})

const currentAppliedColor = computed(() => getSharedAppliedColor(nodes))
const currentPickerValue = computed(() =>
  (currentAppliedColor.value ?? getDefaultCustomNodeColor()).replace('#', '')
)

async function applySavedCustomColor(color: string) {
  applyCustomColorToItems(nodes, color, {
    darkerHeader: darkerHeader.value
  })
  await rememberRecentColor(color)
  emit('changed')
}

async function toggleCurrentColorFavorite() {
  if (!currentAppliedColor.value) return
  await toggleFavoriteColor(currentAppliedColor.value)
}

const isCurrentColorFavorite = computed(() =>
  isFavoriteColor(currentAppliedColor.value)
)

async function onCustomColorUpdate(value: string) {
  await applySavedCustomColor(`#${value}`)
}
</script>

<template>
  <LayoutField :label="t('rightSidePanel.color')">
    <div class="space-y-2">
      <div
        class="grid grid-cols-5 justify-items-center gap-1 rounded-lg border-none bg-secondary-background p-1"
      >
        <button
          v-for="option of colorOptions"
          :key="option.name"
          :class="
            cn(
              'flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-left ring-0 outline-0',
              option.name === nodeColor
                ? 'bg-interface-menu-component-surface-selected'
                : 'hover:bg-interface-menu-component-surface-selected'
            )
          "
          @click="nodeColor = option.name"
        >
          <div
            v-tooltip.top="option.localizedName()"
            :class="cn('size-4 rounded-full ring-2 ring-gray-500/10')"
            :style="{
              backgroundColor: isLightTheme
                ? option.value.light
                : option.value.dark,
              '--tw-ring-color':
                option.name === nodeColor
                  ? isLightTheme
                    ? option.value.ringLight
                    : option.value.ringDark
                  : undefined
            }"
            :data-testid="option.name"
          />
        </button>
      </div>
      <div class="flex items-center gap-2">
        <ColorPicker
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
      <div v-if="favoriteColors.length" class="flex flex-wrap gap-1">
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
      <div v-if="recentColors.length" class="flex flex-wrap gap-1">
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
  </LayoutField>
</template>
