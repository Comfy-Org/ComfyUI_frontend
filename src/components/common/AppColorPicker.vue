<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'
import type { ColorPickerProps } from '@/components/ui/color-picker/types'

const {
  class: className,
  alpha = true,
  disabled = false,
  accessibleLabel
} = defineProps<
  Pick<ColorPickerProps, 'class' | 'alpha' | 'disabled'> &
    Partial<Pick<ColorPickerProps, 'accessibleLabel'>>
>()

const color = defineModel<string>({ default: '#000000' })
const { t } = useI18n()
</script>

<template>
  <ColorPicker
    v-model="color"
    :class="className"
    :alpha
    :disabled
    :accessible-label="accessibleLabel ?? `${t('g.color')} ${color}`"
    :hex-label="t('color.hex')"
    :rgba-label="t('color.rgba')"
    :hue-label="t('color.hue')"
    :alpha-label="t('color.alpha')"
    :red-label="t('color.red')"
    :green-label="t('color.green')"
    :blue-label="t('color.blue')"
    :saturation-brightness-label="t('color.saturationBrightness')"
    :format-label="t('g.color')"
  >
    <template v-if="$slots.trigger" #trigger><slot name="trigger" /></template>
  </ColorPicker>
</template>
