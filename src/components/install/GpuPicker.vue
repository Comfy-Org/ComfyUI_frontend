<template>
  <div
    class="grid grid-rows-[1fr_auto_auto_1fr] w-full max-w-3xl mx-auto h-[40rem] select-none"
  >
    <!-- Title at top -->
    <h2
      class="text-3xl text-neutral-100 text-center italic"
      style="font-family: 'ABC ROM Black Italic', sans-serif"
    >
      {{ $t('install.gpuPicker.title') }}
    </h2>

    <!-- GPU Selection buttons - takes up remaining space and centers content -->
    <div class="flex-1 flex gap-8 justify-center items-center">
      <!-- Apple Metal -->
      <HardwareOption
        v-if="platform === 'darwin'"
        :image-path="'/assets/images/apple-mps-logo.png'"
        placeholder-text="Apple Metal"
        subtitle="Apple Metal"
        value="mps"
        :selected="selected === 'mps'"
        :recommended="true"
        @click="pickGpu('mps')"
      />
      <!-- CPU -->
      <HardwareOption
        placeholder-text="CPU"
        subtitle="Subtitle"
        value="cpu"
        :selected="selected === 'cpu'"
        @click="pickGpu('cpu')"
      />
      <!-- Manual Install -->
      <HardwareOption
        placeholder-text="Manual Install"
        subtitle="Subtitle"
        value="unsupported"
        :selected="selected === 'unsupported'"
        @click="pickGpu('unsupported')"
      />
    </div>

    <div class="pt-12 px-24 h-16">
      <div v-show="selected === 'mps'" class="flex items-center gap-2">
        <Tag
          :value="$t('install.gpuPicker.recommended')"
          class="bg-neutral-300 text-neutral-900 rounded-full normal-case text-sm font-medium px-3"
        />
        <i-lucide:badge-check class="text-neutral-300 text-lg" />
      </div>
    </div>

    <!-- Description text at bottom -->
    <div class="text-neutral-300 px-24">
      <p v-if="selected === 'mps'" class="leading-relaxed">
        {{ $t('install.gpuPicker.appleMetalDescription') }}
      </p>
      <p v-if="selected === 'cpu'" class="leading-relaxed">
        {{ $t('install.gpuPicker.cpuDescription') }}
      </p>
      <p v-if="selected === 'unsupported'" class="leading-relaxed">
        {{ $t('install.gpuPicker.manualDescription') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TorchDeviceType } from '@comfyorg/comfyui-electron-types'
import Tag from 'primevue/tag'

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
