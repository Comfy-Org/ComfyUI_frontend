<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import type { HSVA } from '@/utils/colorUtil'
import {
  hexToHsva,
  hexToRgb,
  hsbToRgb,
  hsvaToHex,
  rgbToHex
} from '@/utils/colorUtil'
import { cn } from '@/utils/tailwindUtil'

import ColorPickerPanel from './ColorPickerPanel.vue'

const { alphaEnabled = true } = defineProps<{
  alphaEnabled?: boolean
  class?: string
}>()

const modelValue = defineModel<string>({ default: '#000000' })

const hsva = ref<HSVA>(hexToHsva(modelValue.value || '#000000'))
const displayMode = ref<'hex' | 'rgba'>('hex')

const isInternalUpdate = ref(false)

watch(modelValue, (newVal) => {
  if (isInternalUpdate.value) {
    isInternalUpdate.value = false
    return
  }
  hsva.value = hexToHsva(newVal || '#000000')
})

watch(
  hsva,
  (newHsva) => {
    const hex = hsvaToHex(newHsva)
    if (hex !== modelValue.value) {
      isInternalUpdate.value = true
      modelValue.value = hex
    }
  },
  { deep: true }
)

const previewColor = computed(() => {
  const rgb = hsbToRgb({
    h: hsva.value.h,
    s: hsva.value.s,
    b: hsva.value.v
  })
  const hex = rgbToHex(rgb)
  const a = hsva.value.a / 100
  if (a < 1) {
    const alphaHex = Math.round(a * 255)
      .toString(16)
      .padStart(2, '0')
    return `${hex}${alphaHex}`
  }
  return hex
})

const displayRgb = computed(() =>
  hexToRgb(
    rgbToHex(hsbToRgb({ h: hsva.value.h, s: hsva.value.s, b: hsva.value.v }))
  )
)

const displayHex = computed(() =>
  rgbToHex(
    hsbToRgb({ h: hsva.value.h, s: hsva.value.s, b: hsva.value.v })
  ).toLowerCase()
)
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        :class="
          cn(
            'flex h-8 w-full items-center rounded-lg bg-node-component-surface pr-2',
            $props.class
          )
        "
      >
        <div class="relative size-8 shrink-0 overflow-hidden rounded-l-lg">
          <div
            class="absolute inset-0"
            :style="{
              backgroundImage:
                'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%)',
              backgroundSize: '8px 8px'
            }"
          />
          <div
            class="absolute inset-0"
            :style="{ backgroundColor: previewColor }"
          />
        </div>
        <div
          class="flex flex-1 items-center justify-between pl-1 text-xs text-node-component-slot-text"
        >
          <template v-if="displayMode === 'hex'">
            <span>{{ displayHex }}</span>
          </template>
          <template v-else>
            <div class="flex gap-2">
              <span>{{ displayRgb.r }}</span>
              <span>{{ displayRgb.g }}</span>
              <span>{{ displayRgb.b }}</span>
            </div>
          </template>
          <span v-if="alphaEnabled">{{ hsva.a }}%</span>
        </div>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="7"
        :collision-padding="10"
        class="z-1700"
      >
        <ColorPickerPanel
          v-model:hsva="hsva"
          v-model:display-mode="displayMode"
          :alpha-enabled="alphaEnabled"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
