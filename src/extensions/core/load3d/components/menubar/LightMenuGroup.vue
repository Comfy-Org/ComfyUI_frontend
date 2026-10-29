<template>
  <PopoverRoot v-if="isOriginalMaterial" v-model:open="intensityOpen">
    <PopoverTrigger as-child>
      <Button
        variant="textonly"
        size="unset"
        :tooltip="t('load3d.menuBar.intensity')"
        tooltip-side="bottom"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.intensity') : undefined"
      >
        <i class="icon-[lucide--sun]" />
        <span v-if="!compact">{{ t('load3d.menuBar.intensity') }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      :side-offset="8"
      :class="cn(formPanelClass, 'w-56')"
    >
      <div class="flex flex-col gap-2 p-1">
        <span class="text-sm text-foreground">{{
          t('load3d.lightIntensity')
        }}</span>
        <Slider
          :model-value="[sliderValue]"
          :min="sliderMin"
          :max="sliderMax"
          :step="sliderStep"
          @update:model-value="onIntensityUpdate"
        />
      </div>
    </PopoverContent>
  </PopoverRoot>
  <span v-else class="px-2 text-sm text-muted-foreground">{{
    t('load3d.menuBar.originalMaterialOnly')
  }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  actionClass,
  formPanelClass
} from '@/extensions/core/load3d/components/menubar/menuBarStyles'
import { usePopoverExclusivity } from '@/extensions/core/load3d/components/menubar/usePopoverExclusivity'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import Slider from '@comfyorg/design-system/slider/Slider'
import Button from '@comfyorg/design-system/button/Button'
import type { LightConfig } from '@comfyorg/viewport3d/load3d/interfaces'
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'

const { compact = false, isOriginalMaterial = false } = defineProps<{
  compact?: boolean
  isOriginalMaterial?: boolean
}>()

const config = defineModel<LightConfig>('config')

const { t } = useI18n()

const intensityOpen = usePopoverExclusivity()('light-intensity')

const settingStore = useSettingStore()
const lightIntensityMinimum = settingStore.get(
  'Comfy.Load3D.LightIntensityMinimum'
)
const lightIntensityMaximum = settingStore.get(
  'Comfy.Load3D.LightIntensityMaximum'
)
const lightAdjustmentIncrement = settingStore.get(
  'Comfy.Load3D.LightAdjustmentIncrement'
)

const usesHdriIntensity = computed(
  () => !!config.value?.hdri?.hdriPath?.length && !!config.value?.hdri?.enabled
)

const sliderMin = computed(() =>
  usesHdriIntensity.value ? 0 : lightIntensityMinimum
)
const sliderMax = computed(() =>
  usesHdriIntensity.value ? 5 : lightIntensityMaximum
)
const sliderStep = computed(() =>
  usesHdriIntensity.value ? 0.1 : lightAdjustmentIncrement
)
const sliderValue = computed(() =>
  usesHdriIntensity.value
    ? (config.value?.hdri?.intensity ?? 1)
    : (config.value?.intensity ?? lightIntensityMinimum)
)

function onIntensityUpdate(value?: number[]) {
  if (!value?.length || !config.value) return
  const next = value[0]
  if (usesHdriIntensity.value) {
    if (config.value.hdri) config.value.hdri.intensity = next
  } else {
    config.value.intensity = next
  }
}
</script>
