<template>
  <div
    class="flex w-[211px] flex-col gap-2 rounded-lg border border-border/50 bg-background p-2 shadow-md"
  >
    <ColorPickerSaturationValue
      v-model:saturation="hsva.s"
      v-model:value="hsva.v"
      :hue="hsva.h"
      :aria-label="saturationBrightnessLabel"
    />
    <ColorPickerSlider v-model="hsva.h" type="hue" :aria-label="hueLabel" />
    <ColorPickerSlider
      v-if="alpha"
      v-model="hsva.a"
      type="alpha"
      :hue="hsva.h"
      :saturation="hsva.s"
      :brightness="hsva.v"
      :aria-label="alphaLabel"
    />
    <div class="flex items-center gap-1">
      <Select v-model="displayMode">
        <SelectTrigger
          :aria-label="formatLabel"
          class="h-6 w-[58px] shrink-0 gap-0.5 overflow-clip rounded-sm border-0 px-1.5 py-0 text-xs [&>span]:overflow-visible"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent class="min-w-16 p-1">
          <SelectItem value="hex" class="py-1 text-xs">
            {{ hexLabel }}
          </SelectItem>
          <SelectItem value="rgba" class="py-1 text-xs">
            {{ rgbaLabel }}
          </SelectItem>
        </SelectContent>
      </Select>
      <div
        class="flex h-6 min-w-0 flex-1 items-center gap-1 rounded-sm bg-secondary px-1 text-xs text-muted-foreground"
      >
        <template v-if="displayMode === 'hex'">
          <input
            v-model="hex.draft"
            type="text"
            spellcheck="false"
            :aria-label="hexLabel"
            class="min-w-0 flex-1 appearance-none border-none bg-transparent p-0 text-center outline-none"
            @focus="hex.beginEdit"
            @input="hex.commit"
            @keydown.enter="hex.commit"
            @blur="hex.reset"
          />
        </template>
        <template v-else>
          <input
            v-for="channel in rgbChannels"
            :key="channel.key"
            v-model.number="rgb.draft[channel.key]"
            type="number"
            :min="0"
            :max="255"
            :aria-label="channelLabels[channel.key]"
            class="min-w-0 flex-1 appearance-none border-none bg-transparent p-0 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none"
            @focus="rgb.beginEdit"
            @input="rgb.commit"
            @keydown.enter="rgb.commit"
            @blur="rgb.reset"
          />
        </template>
        <div
          v-if="alpha"
          class="flex shrink-0 items-center border-l border-border/50 pl-1"
        >
          <input
            v-model.number="alphaField.draft"
            type="number"
            :min="0"
            :max="100"
            :aria-label="alphaLabel"
            class="w-6 min-w-0 appearance-none border-none bg-transparent p-0 text-right outline-none [&::-webkit-inner-spin-button]:appearance-none"
            @focus="alphaField.beginEdit"
            @input="alphaField.commit"
            @keydown.enter="alphaField.commit"
            @blur="alphaField.reset"
          />
          <span>%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import type { HSVA } from '@/utils/colorUtil'

import ColorPickerSaturationValue from './ColorPickerSaturationValue.vue'
import ColorPickerSlider from './ColorPickerSlider.vue'
import { rgbChannels, useColorPicker } from './useColorPicker'

const {
  alpha = true,
  hexLabel,
  rgbaLabel,
  hueLabel,
  alphaLabel,
  redLabel,
  greenLabel,
  blueLabel,
  saturationBrightnessLabel,
  formatLabel
} = defineProps<{
  alpha?: boolean
  hexLabel: string
  rgbaLabel: string
  hueLabel: string
  alphaLabel: string
  redLabel: string
  greenLabel: string
  blueLabel: string
  saturationBrightnessLabel: string
  formatLabel: string
}>()

const hsva = defineModel<HSVA>('hsva', { required: true })
const displayMode = defineModel<'hex' | 'rgba'>('displayMode', {
  required: true
})

const channelLabels = computed(() => ({
  r: redLabel,
  g: greenLabel,
  b: blueLabel
}))

const { hex, rgb, alpha: alphaField } = useColorPicker(hsva)
</script>
