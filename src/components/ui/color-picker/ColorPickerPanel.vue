<template>
  <div
    class="flex w-[211px] flex-col gap-2 rounded-lg border border-border-subtle bg-base-background p-2 shadow-md"
  >
    <ColorPickerSaturationValue
      v-model:saturation="hsva.s"
      v-model:value="hsva.v"
      :hue="hsva.h"
    />
    <ColorPickerSlider v-model="hsva.h" type="hue" />
    <ColorPickerSlider
      v-if="alpha"
      v-model="hsva.a"
      type="alpha"
      :hue="hsva.h"
      :saturation="hsva.s"
      :brightness="hsva.v"
    />
    <div class="flex items-center gap-1">
      <Select v-model="displayMode">
        <SelectTrigger
          class="h-6 w-[58px] shrink-0 gap-0.5 overflow-clip rounded-sm border-0 px-1.5 py-0 text-xs [&>span]:overflow-visible"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent class="min-w-16 p-1">
          <SelectItem value="hex" class="px-2 py-1 text-xs">
            {{ t('color.hex') }}
          </SelectItem>
          <SelectItem value="rgba" class="px-2 py-1 text-xs">
            {{ t('color.rgba') }}
          </SelectItem>
        </SelectContent>
      </Select>
      <div
        class="flex h-6 min-w-0 flex-1 items-center gap-1 rounded-sm bg-secondary-background px-1 text-xs text-node-component-slot-text"
      >
        <template v-if="displayMode === 'hex'">
          <input
            v-model="hex.draft"
            type="text"
            spellcheck="false"
            :aria-label="t('color.hex')"
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
            :aria-label="t(channel.label)"
            class="min-w-0 flex-1 appearance-none border-none bg-transparent p-0 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none"
            @focus="rgb.beginEdit"
            @input="rgb.commit"
            @keydown.enter="rgb.commit"
            @blur="rgb.reset"
          />
        </template>
        <div
          v-if="alpha"
          class="flex shrink-0 items-center border-l border-border-subtle pl-1"
        >
          <input
            v-model.number="alphaField.draft"
            type="number"
            :min="0"
            :max="100"
            :aria-label="t('color.alpha')"
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
import { useI18n } from 'vue-i18n'

import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import type { HSVA } from '@/utils/colorUtil'

import ColorPickerSaturationValue from './ColorPickerSaturationValue.vue'
import ColorPickerSlider from './ColorPickerSlider.vue'
import { rgbChannels, useColorPicker } from './useColorPicker'

const { alpha = true } = defineProps<{ alpha?: boolean }>()

const hsva = defineModel<HSVA>('hsva', { required: true })
const displayMode = defineModel<'hex' | 'rgba'>('displayMode', {
  required: true
})

const { t } = useI18n()

const { hex, rgb, alpha: alphaField } = useColorPicker(hsva)
</script>
