<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useNodeColorOptions } from '@/composables/graph/useNodeColorOptions'
import type { IColorable } from '@/lib/litegraph/src/interfaces'
import { cn } from '@/utils/tailwindUtil'

import LayoutField from './LayoutField.vue'

const { nodes } = defineProps<{ nodes: IColorable[] }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const { t } = useI18n()

const { colorOptions, applyColorToItems, getCurrentColorName, isLightTheme } =
  useNodeColorOptions({
    includeRingColors: true,
    lightnessAdjustments: {
      dark: 0.3,
      light: 0.4,
      ringDark: 0.5,
      ringLight: 0.1
    },
    localizedNameAsFunction: true
  })

const nodeColor = computed<string | null>({
  get() {
    return getCurrentColorName(nodes)
  },
  set(colorName) {
    if (colorName === null) return

    applyColorToItems(nodes, colorName)
    emit('changed')
  }
})
</script>

<template>
  <LayoutField :label="t('rightSidePanel.color')">
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
          v-tooltip.top="
            typeof option.localizedName === 'function'
              ? option.localizedName()
              : option.localizedName
          "
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
  </LayoutField>
</template>
