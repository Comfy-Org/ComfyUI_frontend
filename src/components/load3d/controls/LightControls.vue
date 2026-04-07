<template>
  <div class="flex flex-col">
    <div v-if="showLightIntensityButton" class="relative">
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
        <i class="pi pi-sun text-lg text-base-foreground" />
      </Button>
      <div
        v-show="showLightIntensity"
        ref="panelRef"
        class="absolute top-0 left-12 w-[150px] rounded-lg bg-black/50 p-4 shadow-lg"
      >
        <Slider
          v-model="lightIntensity"
          class="w-full"
          :min="lightIntensityMinimum"
          :max="lightIntensityMaximum"
          :step="lightAdjustmentIncrement"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Slider from 'primevue/slider'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useDismissableOverlay } from '@/composables/useDismissableOverlay'
import type { MaterialMode } from '@/extensions/core/load3d/interfaces'
import { useSettingStore } from '@/platform/settings/settingStore'

const lightIntensity = defineModel<number>('lightIntensity')
const materialMode = defineModel<MaterialMode>('materialMode')

const { hdriEnabled = false } = defineProps<{
  hdriEnabled?: boolean
}>()

const showLightIntensityButton = computed(
  () => materialMode.value === 'original' && !hdriEnabled
)
const showLightIntensity = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<InstanceType<typeof Button> | null>(null)

const lightIntensityMaximum = useSettingStore().get(
  'Comfy.Load3D.LightIntensityMaximum'
)
const lightIntensityMinimum = useSettingStore().get(
  'Comfy.Load3D.LightIntensityMinimum'
)
const lightAdjustmentIncrement = useSettingStore().get(
  'Comfy.Load3D.LightAdjustmentIncrement'
)

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
</script>
