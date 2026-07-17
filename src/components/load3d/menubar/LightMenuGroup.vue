<template>
  <Popover v-if="isOriginalMaterial">
    <PopoverTrigger as-child>
      <button
        v-tooltip.bottom="tip(t('load3d.menuBar.intensity'))"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.intensity') : undefined"
      >
        <i class="icon-[lucide--sun] size-4" />
        <span v-if="!compact">{{ t('load3d.menuBar.intensity') }}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="start"
      :side-offset="8"
      :class="cn(panelClass, 'w-56')"
    >
      <div class="flex flex-col gap-2 p-1">
        <span class="text-sm text-base-foreground">{{
          t('load3d.lightIntensity')
        }}</span>
        <Slider
          :model-value="[sliderValue]"
          :min="sliderMin"
          :max="sliderMax"
          :step="sliderStep"
          class="w-full"
          @update:model-value="onIntensityUpdate"
        />
      </div>
    </PopoverContent>
  </Popover>
  <span v-else class="px-2 text-sm text-muted">{{
    t('load3d.menuBar.originalMaterialOnly')
  }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  actionClass,
  panelClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import type { LightConfig } from '@/extensions/core/load3d/interfaces'
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverTrigger } from 'reka-ui'

const { compact = false, isOriginalMaterial = false } = defineProps<{
  compact?: boolean
  isOriginalMaterial?: boolean
}>()

const config = defineModel<LightConfig>('config')

const { t } = useI18n()

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
