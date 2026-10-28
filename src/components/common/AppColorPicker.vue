<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ColorPicker from '@comfyorg/design-system/color-picker/ColorPicker'
import type { ColorPickerProps } from '@comfyorg/design-system/lib/color-picker/types'

const {
  class: className,
  alpha = true,
  disabled = false,
  accessibleLabel
} = defineProps<
  Pick<ColorPickerProps, 'class' | 'alpha' | 'disabled' | 'accessibleLabel'>
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
    :accessible-label="accessibleLabel"
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
