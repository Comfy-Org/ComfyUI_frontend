<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { HSVA } from '@/utils/colorUtil'
import { hsbToRgb, rgbToHex } from '@/utils/colorUtil'

import ColorPickerSaturationValue from './ColorPickerSaturationValue.vue'
import ColorPickerSlider from './ColorPickerSlider.vue'

const hsva = defineModel<HSVA>('hsva', { required: true })
const displayMode = defineModel<'hex' | 'rgba'>('displayMode', {
  required: true
})

const { alphaEnabled = true } = defineProps<{
  alphaEnabled?: boolean
}>()

const rgb = computed(() =>
  hsbToRgb({ h: hsva.value.h, s: hsva.value.s, b: hsva.value.v })
)
const hexString = computed(() => rgbToHex(rgb.value).toLowerCase())

const { t } = useI18n()

function toggleDisplayMode() {
  displayMode.value = displayMode.value === 'hex' ? 'rgba' : 'hex'
}
</script>

<template>
  <div
    class="flex w-[209px] flex-col gap-2 rounded-lg border border-border-subtle bg-base-background p-2 shadow-md"
  >
    <ColorPickerSaturationValue
      v-model:saturation="hsva.s"
      v-model:value="hsva.v"
      :hue="hsva.h"
    />
    <ColorPickerSlider v-model="hsva.h" type="hue" />
    <ColorPickerSlider
      v-if="alphaEnabled"
      v-model="hsva.a"
      type="alpha"
      :hue="hsva.h"
      :saturation="hsva.s"
      :brightness="hsva.v"
    />
    <div class="flex items-center gap-2">
      <button
        class="flex h-6 shrink-0 items-center gap-1 rounded-sm bg-secondary-background px-2 text-xs text-base-foreground"
        @click="toggleDisplayMode"
      >
        {{ displayMode === 'hex' ? t('color.hex') : t('color.rgba') }}
        <i class="icon-[lucide--chevron-down] size-3" />
      </button>
      <div
        class="flex flex-1 items-center justify-center rounded-sm bg-secondary-background px-1 text-xs text-node-component-slot-text"
      >
        <template v-if="displayMode === 'hex'">
          <span class="flex-1 text-center">{{ hexString }}</span>
        </template>
        <template v-else>
          <span class="w-6 text-center">{{ rgb.r }}</span>
          <span class="w-6 text-center">{{ rgb.g }}</span>
          <span class="w-6 text-center">{{ rgb.b }}</span>
        </template>
        <template v-if="alphaEnabled">
          <span class="border-l border-border-subtle pl-1">{{ hsva.a }}%</span>
        </template>
      </div>
    </div>
  </div>
</template>
