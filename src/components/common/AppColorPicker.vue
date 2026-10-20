<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'

type ColorPickerProps = ComponentProps<typeof ColorPicker>

const {
  class: className,
  alpha = true,
  disabled = false,
  accessibleLabel
} = defineProps<{
  class?: ColorPickerProps['class']
  alpha?: ColorPickerProps['alpha']
  disabled?: ColorPickerProps['disabled']
  accessibleLabel?: ColorPickerProps['accessibleLabel']
}>()

const color = defineModel<string>({ default: '#000000' })
const { t } = useI18n()
</script>

<template>
  <ColorPicker
    v-model="color"
    :class="className"
    :alpha
    :disabled
    :accessible-label="accessibleLabel ?? t('g.color')"
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
