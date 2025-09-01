<template>
  <div class="flex flex-col gap-6 w-[600px] h-[30rem] select-none">
    <!-- Installation Path Section -->
    <div class="grow flex flex-col gap-4 text-neutral-300">
      <h2 class="text-2xl font-semibold text-neutral-100">
        Choose your hardware setup
      </h2>

      <!-- GPU Selection buttons -->
      <div class="flex gap-4 justify-center">
        <!-- Apple Metal -->
        <HardwareOption
          v-if="platform === 'darwin'"
          :image-path="'/assets/images/apple-mps-logo.png'"
          :title="'Apple Metal'"
          :subtitle="''"
          value="mps"
          :selected="selected === 'mps'"
          @click="pickGpu('mps')"
        />
        <!-- CPU -->
        <HardwareOption
          :title="'CPU'"
          :subtitle="'Subtitle'"
          value="cpu"
          :selected="selected === 'cpu'"
          @click="pickGpu('cpu')"
        />
        <!-- Manual Install -->
        <HardwareOption
          :title="'Manual Install'"
          :subtitle="'Subtitle'"
          value="unsupported"
          :selected="selected === 'unsupported'"
          @click="pickGpu('unsupported')"
        />
      </div>

      <!-- Description text -->
      <div class="mt-6 text-center text-sm text-neutral-400">
        <p v-if="selected === 'mps'">
          Leverages your Mac's GPU for faster speed and a better overall
          experience
        </p>
        <p v-if="selected === 'cpu'">
          Use CPU mode for compatibility when GPU acceleration is not available
        </p>
        <p v-if="selected === 'unsupported'">
          Configure ComfyUI manually for advanced setups or unsupported hardware
        </p>
      </div>

    </div>

    <!-- Progress dots -->
    <div class="flex justify-center gap-2">
      <div
        v-for="i in 4"
        :key="i"
        class="h-2 w-2 rounded-full transition-colors"
        :class="i === 1 ? 'bg-yellow-500' : 'bg-neutral-700'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TorchDeviceType } from '@comfyorg/comfyui-electron-types'

import HardwareOption from '@/components/install/HardwareOption.vue'
import { electronAPI } from '@/utils/envUtil'
const selected = defineModel<TorchDeviceType | null>('device', {
  required: true
})

const electron = electronAPI()
const platform = electron.getPlatform()

const pickGpu = (value: typeof selected.value) => {
  const newValue = selected.value === value ? null : value
  selected.value = newValue
}
</script>

<style scoped>
@reference '../../assets/css/style.css';

.p-tag {
  --p-tag-gap: 0.5rem;
}

.hover-brighten {
  @apply transition-colors;
  transition-property: filter, box-shadow;

  &:hover {
    filter: brightness(107%) contrast(105%);
    box-shadow: 0 0 0.25rem #ffffff79;
  }
}
.p-accordioncontent-content {
  @apply bg-neutral-900 rounded-lg transition-colors;
}

div.selected {
  .gpu-button:not(.selected) {
    @apply opacity-50 hover:opacity-100;
  }
}

.gpu-button {
  @apply w-1/2 m-0 cursor-pointer rounded-lg flex flex-col items-center justify-around bg-neutral-800/50 hover:bg-neutral-800/75 transition-colors;

  &.selected {
    @apply opacity-100 bg-neutral-700/50 hover:bg-neutral-700/60;
  }
}

.disabled {
  @apply pointer-events-none opacity-40;
}

.p-card-header {
  @apply text-center grow;
}

.p-card-body {
  @apply text-center pt-0;
}
</style>
