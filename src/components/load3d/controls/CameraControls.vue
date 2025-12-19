<template>
  <div class="flex flex-col">
    <Button
      size="icon"
      variant="textonly"
      class="rounded-full"
      @click="switchCamera"
    >
      <i
        v-tooltip.right="{
          value: $t('load3d.switchCamera'),
          showDelay: 300
        }"
        :class="['pi', 'pi-camera', 'text-lg text-white']"
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

const cameraType = defineModel<CameraType>('cameraType')
const fov = defineModel<number>('fov')
const showFOVButton = computed(() => cameraType.value === 'perspective')

const switchCamera = () => {
  cameraType.value =
    cameraType.value === 'perspective' ? 'orthographic' : 'perspective'
}
</script>
