<script setup lang="ts">
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import type { ColorPickerProps } from '@/components/ui/color-picker/types'
import type { HSVA } from '@/utils/colorUtil'
import { hexToHsva, hsbToRgb, hsvaToHex, rgbToHex } from '@/utils/colorUtil'
import { cn } from '@comfyorg/tailwind-utils'

import ColorPickerPanel from './ColorPickerPanel.vue'

const { alpha = true, accessibleLabel } = defineProps<ColorPickerProps>()

const modelValue = defineModel<string>({ default: '#000000' })

function readHsva(hex: string): HSVA {
  const next = hexToHsva(hex || '#000000')
  if (!alpha) next.a = 100
  return next
}

const hsva = ref<HSVA>(readHsva(modelValue.value))
const displayMode = ref<'hex' | 'rgba'>('hex')

watch(modelValue, (newVal) => {
  const current = hsvaToHex(hsva.value)
  if (newVal !== current) {
    hsva.value = readHsva(newVal)
  }
})

watch(
  hsva,
  (newHsva) => {
    const hex = hsvaToHex(newHsva)
    if (hex !== modelValue.value) {
      modelValue.value = hex
    }
  },
  { deep: true }
)

const baseRgb = computed(() =>
  hsbToRgb({ h: hsva.value.h, s: hsva.value.s, b: hsva.value.v })
)

const previewColor = computed(() => {
  const hex = rgbToHex(baseRgb.value)
  const a = hsva.value.a / 100
  if (a < 1) {
    const alphaHex = Math.round(a * 255)
      .toString(16)
      .padStart(2, '0')
    return `${hex}${alphaHex}`
  }
  return hex
})

const displayHex = computed(() => rgbToHex(baseRgb.value).toLowerCase())

const isOpen = ref(false)
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <slot name="trigger">
        <button
          type="button"
          :disabled="$props.disabled"
          :aria-label="accessibleLabel"
          :class="
            cn(
              'flex h-8 w-full items-center overflow-clip rounded-lg border border-transparent bg-secondary pr-2 outline-none hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
              isOpen && 'border-border',
              $props.class
            )
          "
        >
          <div class="flex size-8 shrink-0 items-center justify-center">
            <div class="relative size-4 overflow-hidden rounded-sm">
              <div
                class="absolute inset-0"
                :style="{
                  backgroundImage:
                    'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%)',
                  backgroundSize: '4px 4px'
                }"
              />
              <div
                class="absolute inset-0"
                :style="{ backgroundColor: previewColor }"
              />
            </div>
          </div>
          <div
            class="flex flex-1 items-center justify-between pl-1 text-xs text-foreground"
          >
            <template v-if="displayMode === 'hex'">
              <span>{{ displayHex }}</span>
            </template>
            <template v-else>
              <div class="flex gap-2">
                <span>{{ baseRgb.r }}</span>
                <span>{{ baseRgb.g }}</span>
                <span>{{ baseRgb.b }}</span>
              </div>
            </template>
            <span v-if="alpha">{{ hsva.a }}%</span>
          </div>
        </button>
      </slot>
    </PopoverTrigger>
    <PopoverPortal :key="Number(isOpen)">
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="7"
        :collision-padding="10"
        class="z-overlay"
      >
        <ColorPickerPanel
          v-model:hsva="hsva"
          v-model:display-mode="displayMode"
          :alpha
          :hex-label="$props.hexLabel"
          :rgba-label="$props.rgbaLabel"
          :hue-label="$props.hueLabel"
          :alpha-label="$props.alphaLabel"
          :red-label="$props.redLabel"
          :green-label="$props.greenLabel"
          :blue-label="$props.blueLabel"
          :saturation-brightness-label="$props.saturationBrightnessLabel"
          :format-label="$props.formatLabel"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
