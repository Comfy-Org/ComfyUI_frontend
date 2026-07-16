<template>
  <div class="flex flex-col">
    <Button
      v-tooltip.right="{
        value: $t('load3d.switchCamera'),
        showDelay: 300
      }"
      size="icon"
      variant="textonly"
      class="rounded-full"
      :aria-label="$t('load3d.switchCamera')"
      @click="switchCamera"
    >
      <i class="pi pi-camera text-lg text-base-foreground" />
    </Button>
    <Button
      v-if="hasCustomUp"
      v-tooltip.right="{
        value: useCustomUp
          ? $t('load3d.useNaturalUp')
          : $t('load3d.useCustomUp'),
        showDelay: 300
      }"
      size="icon"
      variant="textonly"
      class="rounded-full"
      :aria-label="
        useCustomUp ? $t('load3d.useNaturalUp') : $t('load3d.useCustomUp')
      "
      @click="toggleUp"
    >
      <i
        :class="
          cn(
            useCustomUp
              ? 'icon-[lucide--compass]'
              : 'icon-[lucide--rotate-ccw]',
            'size-5 text-base-foreground'
          )
        "
      />
    </Button>
    <PopupSlider
      v-if="showFOVButton"
      v-model="fov"
      :tooltip-text="$t('load3d.fov')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import PopupSlider from '@/components/load3d/controls/PopupSlider.vue'
import Button from '@/components/ui/button/Button.vue'
import type { CameraType } from '@/extensions/core/load3d/interfaces'
import { cn } from '@comfyorg/tailwind-utils'

const { hasCustomUp = false } = defineProps<{
  hasCustomUp?: boolean
}>()

const cameraType = defineModel<CameraType>('cameraType')
const fov = defineModel<number>('fov')
const useCustomUp = defineModel<boolean>('useCustomUp', { default: false })

const showFOVButton = computed(() => cameraType.value === 'perspective')

const switchCamera = () => {
  cameraType.value =
    cameraType.value === 'perspective' ? 'orthographic' : 'perspective'
}

const toggleUp = () => {
  useCustomUp.value = !useCustomUp.value
}
</script>
