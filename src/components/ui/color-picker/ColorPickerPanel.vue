<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import type { HSVA } from '@/utils/colorUtil'
import { hsbToRgb, rgbToHex } from '@/utils/colorUtil'

import ColorPickerSaturationValue from './ColorPickerSaturationValue.vue'
import ColorPickerSlider from './ColorPickerSlider.vue'

const hsva = defineModel<HSVA>('hsva', { required: true })
const displayMode = defineModel<'hex' | 'rgba'>('displayMode', {
  required: true
})

const rgb = computed(() =>
  hsbToRgb({ h: hsva.value.h, s: hsva.value.s, b: hsva.value.v })
)
const hexString = computed(() => rgbToHex(rgb.value).toLowerCase())

const { t } = useI18n()
</script>

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
          <span class="min-w-0 flex-1 truncate text-center">{{
            hexString
          }}</span>
        </template>
        <template v-else>
          <span class="w-6 shrink-0 text-center">{{ rgb.r }}</span>
          <span class="w-6 shrink-0 text-center">{{ rgb.g }}</span>
          <span class="w-6 shrink-0 text-center">{{ rgb.b }}</span>
        </template>
        <span class="shrink-0 border-l border-border-subtle pl-1"
          >{{ hsva.a }}%</span
        >
      </div>
    </div>
  </div>
</template>
