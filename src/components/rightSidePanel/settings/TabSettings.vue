<template>
  <div class="space-y-4 p-3 text-sm text-muted-foreground">
    <!-- Node State -->
    <div class="flex flex-col gap-2">
      <span>
        {{ t('rightSidePanel.nodeState') }}
      </span>
      <FormSelectButton
        v-model="nodeState"
        class="w-full"
        :options="[
          {
            label: t('rightSidePanel.normal'),
            value: LGraphEventMode.ALWAYS
          },
          {
            label: t('rightSidePanel.bypass'),
            value: LGraphEventMode.BYPASS
          },
          {
            label: t('rightSidePanel.mute'),
            value: LGraphEventMode.NEVER
          }
        ]"
      />
    </div>

    <!-- Color Picker -->
    <div class="flex flex-col gap-2">
      <span>
        {{ t('rightSidePanel.color') }}
      </span>
      <div
        class="bg-secondary-background border-none rounded-lg p-1 grid grid-cols-5 gap-1 justify-items-center"
      >
        <button
          v-for="option of colorOptions"
          :key="option.name"
          :class="
            cn(
              'size-8 rounded-lg bg-transparent border-0 outline-0 ring-0 text-left flex justify-center items-center cursor-pointer',
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
    </div>

    <!-- Pinned Toggle -->
    <div class="flex items-center justify-between">
      <span>
        {{ t('rightSidePanel.pinned') }}
      </span>
      <ToggleSwitch v-model="isPinned" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ColorOption, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import FormSelectButton from '@/renderer/extensions/vueNodes/widgets/components/form/FormSelectButton.vue'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'
import { cn } from '@/utils/tailwindUtil'

const { nodes = [] } = defineProps<{
  nodes?: LGraphNode[]
}>()

const { t } = useI18n()

const canvasStore = useCanvasStore()
const colorPaletteStore = useColorPaletteStore()
const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)

const version = ref(0)
const nodeState = computed({
  get(): LGraphNode['mode'] | null {
    version.value
    if (!nodes.length) return null
    if (nodes.length === 1) {
      return nodes[0].mode
    }

    // For multiple nodes, if all nodes have the same mode, return that mode, otherwise return null
    const mode: LGraphNode['mode'] = nodes[0].mode
    if (!nodes.every((node) => node.mode === mode)) {
      return null
    }

    return mode
  },
  set(value: LGraphNode['mode']) {
    nodes.forEach((node) => {
      node.mode = value
    })
    version.value++
    canvasStore.canvas?.setDirty(true, true)
  }
})

// Pinned state
const isPinned = computed<boolean>({
  get() {
    version.value
    return nodes.some((node) => node.pinned)
  },
  set(value) {
    nodes.forEach((node) => node.pin(value))
    version.value++
    canvasStore.canvas?.setDirty(true, true)
  }
})

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

const nodeColorEntries = Object.entries(LGraphCanvas.node_colors)

const colorOptions: NodeColorOption[] = [
  NO_COLOR_OPTION,
  ...nodeColorEntries.map(([name, color]) => ({
    name,
    localizedName: () => t(`color.${name}`),
    value: getColorValue(color.bgcolor)
  }))
]

const nodeColor = computed<NodeColorOption['name'] | null>({
  get() {
    version.value
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
    version.value++
    canvasStore.canvas?.setDirty(true, true)
  }
})
</script>
