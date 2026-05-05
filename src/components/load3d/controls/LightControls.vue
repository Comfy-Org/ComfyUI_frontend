<template>
  <div class="flex flex-col">
    <div
      v-if="embedded && showIntensityControl"
      class="flex w-[200px] flex-col gap-2 rounded-lg bg-black/50 p-3 shadow-lg"
    >
      <span class="text-sm font-medium text-base-foreground">{{
        $t('load3d.lightIntensity')
      }}</span>
      <Slider
        :model-value="sliderValue"
        class="w-full"
        :min="sliderMin"
        :max="sliderMax"
        :step="sliderStep"
        @update:model-value="onSliderUpdate"
      />
    </div>
    <div v-else-if="showIntensityControl" class="relative">
      <Button
        ref="triggerRef"
        v-tooltip.right="{
          value: $t('load3d.lightIntensity'),
          showDelay: 300
        }"
        size="icon"
        variant="textonly"
        class="rounded-full"
        :aria-label="$t('load3d.lightIntensity')"
        @click="toggleLightIntensity"
      >
        <i class="icon-[lucide--sun] text-lg text-base-foreground" />
      </Button>
      <div
        v-show="showLightIntensity"
        ref="panelRef"
        class="absolute top-0 left-12 w-[200px] rounded-lg bg-black/50 p-3 shadow-lg"
      >
        <Slider
          :model-value="sliderValue"
          class="w-full"
          :min="sliderMin"
          :max="sliderMax"
          :step="sliderStep"
          @update:model-value="onSliderUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import { useDismissableOverlay } from '@/composables/useDismissableOverlay'
import type {
  HDRIConfig,
  MaterialMode
} from '@/extensions/core/load3d/interfaces'
import { useSettingStore } from '@/platform/settings/settingStore'

const lightIntensity = defineModel<number>('lightIntensity')
const materialMode = defineModel<MaterialMode>('materialMode')
const hdriConfig = defineModel<HDRIConfig | undefined>('hdriConfig')

const { embedded = false } = defineProps<{
  embedded?: boolean
}>()

const usesHdriIntensity = computed(
  () => !!hdriConfig.value?.hdriPath?.length && !!hdriConfig.value?.enabled
)

const showIntensityControl = computed(() => materialMode.value === 'original')

const lightIntensityMaximum = useSettingStore().get(
  'Comfy.Load3D.LightIntensityMaximum'
)
const lightIntensityMinimum = useSettingStore().get(
  'Comfy.Load3D.LightIntensityMinimum'
)
const lightAdjustmentIncrement = useSettingStore().get(
  'Comfy.Load3D.LightAdjustmentIncrement'
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

const sliderValue = computed(() => {
  if (usesHdriIntensity.value) {
    return [hdriConfig.value?.intensity ?? 1]
  }
  return [lightIntensity.value ?? lightIntensityMinimum]
})

const showLightIntensity = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<InstanceType<typeof Button> | null>(null)

useDismissableOverlay({
  isOpen: showLightIntensity,
  getOverlayEl: () => panelRef.value,
  getTriggerEl: () => triggerRef.value?.$el ?? null,
  onDismiss: () => {
    showLightIntensity.value = false
  }
})

function toggleLightIntensity() {
  showLightIntensity.value = !showLightIntensity.value
}

function onSliderUpdate(value: number[] | undefined) {
  if (!value?.length) return
  const next = value[0]
  if (usesHdriIntensity.value) {
    const h = hdriConfig.value
    if (!h) return
    hdriConfig.value = { ...h, intensity: next }
  } else {
    lightIntensity.value = next
  }
}
</script>
