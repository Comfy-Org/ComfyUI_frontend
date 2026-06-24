<template>
  <div ref="container" class="flex flex-wrap items-center gap-1">
    <div
      v-for="(hex, i) in modelValue"
      :key="`${i}-${hex}`"
      :data-index="i"
      :data-hex="hex"
      class="relative size-5 cursor-pointer rounded-sm border border-component-node-border"
      :style="{ background: hex }"
      :title="t('palette.swatchTitle')"
      @click="openPicker(i, $event)"
      @contextmenu.prevent.stop="remove(i)"
      @pointerdown="onPointerDown(i, $event)"
    />
    <button
      v-if="modelValue.length < max"
      type="button"
      class="h-5 rounded-sm border border-component-node-border bg-component-node-widget-background px-2 text-xs leading-none"
      :title="t('palette.addColor')"
      @click="addColor"
    >
      +
    </button>
    <input
      ref="picker"
      type="color"
      class="pointer-events-none absolute size-0 opacity-0"
      @input="onPickerInput"
    />
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePaletteSwatchRow } from '@/composables/palette/usePaletteSwatchRow'

const { max = 5 } = defineProps<{ max?: number }>()
const modelValue = defineModel<string[]>({ required: true })
const { t } = useI18n()

const container = useTemplateRef<HTMLDivElement>('container')
const picker = useTemplateRef<HTMLInputElement>('picker')

const { openPicker, onPickerInput, remove, addColor, onPointerDown } =
  usePaletteSwatchRow({ modelValue, container, picker })
</script>
