<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, shallowRef, triggerRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'
import { cn } from '@/utils/tailwindUtil'

const { group } = defineProps<{
  group: LGraphGroup
}>()

const targetGroup = shallowRef<LGraphGroup | null>(null)
watchEffect(() => {
  targetGroup.value = group
})

const { t } = useI18n()

const canvasStore = useCanvasStore()
const colorPaletteStore = useColorPaletteStore()
const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)

const isPinned = computed<boolean>({
  get() {
    return targetGroup.value?.pinned ?? false
  },
  set(value) {
    if (targetGroup.value) {
      targetGroup.value.pin(value)
      triggerRef(targetGroup)
      canvasStore.canvas?.setDirty(true, true)
    }
  }
})

type GroupColorOption = {
  name: string
  localizedName: () => string
  value: {
    dark: string
    light: string
    ringDark: string
    ringLight: string
  }
}

function getColorValue(color: string): GroupColorOption['value'] {
  return {
    dark: adjustColor(color, { lightness: 0.3 }),
    light: adjustColor(color, { lightness: 0.4 }),
    ringDark: adjustColor(color, { lightness: 0.5 }),
    ringLight: adjustColor(color, { lightness: 0.1 })
  }
}

const NO_COLOR_OPTION: GroupColorOption = {
  name: 'noColor',
  localizedName: () => t('color.noColor'),
  value: getColorValue(LiteGraph.NODE_DEFAULT_BGCOLOR)
}

const groupColorEntries = Object.entries(LGraphCanvas.node_colors)

const colorOptions: GroupColorOption[] = [
  NO_COLOR_OPTION,
  ...groupColorEntries.map(([name, color]) => ({
    name,
    localizedName: () => t(`color.${name}`),
    value: getColorValue(color.groupcolor ?? color.bgcolor)
  }))
]

const groupColor = computed<GroupColorOption['name'] | null>({
  get() {
    if (!targetGroup.value) return null
    const colorOption = targetGroup.value.getColorOption()

    if (colorOption == null || !colorOption.groupcolor)
      return NO_COLOR_OPTION.name
    return (
      groupColorEntries.find(
        ([_, color]) => color.groupcolor === colorOption.groupcolor
      )?.[0] ?? null
    )
  },
  set(colorName) {
    if (colorName === null || !targetGroup.value) return

    const canvasColorOption =
      colorName === NO_COLOR_OPTION.name
        ? null
        : LGraphCanvas.node_colors[colorName]

    targetGroup.value.setColorOption(canvasColorOption)
    triggerRef(targetGroup)
    canvasStore.canvas?.setDirty(true, true)
  }
})
</script>

<template>
  <div class="space-y-4 text-sm text-muted-foreground">
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
              option.name === groupColor
                ? 'bg-interface-menu-component-surface-selected'
                : 'hover:bg-interface-menu-component-surface-selected'
            )
          "
          @click="groupColor = option.name"
        >
          <div
            v-tooltip.top="option.localizedName()"
            :class="cn('size-4 rounded-full ring-2 ring-gray-500/10')"
            :style="{
              backgroundColor: isLightTheme
                ? option.value.light
                : option.value.dark,
              '--tw-ring-color':
                option.name === groupColor
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
