<template>
  <div
    class="grid grid-rows-[1fr_auto_auto_1fr] w-full max-w-3xl mx-auto h-[40rem] select-none"
  >
    <!-- Title at top -->
    <h2 class="font-inter font-bold text-3xl text-neutral-100 text-center">
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
        :subtitle="$t('install.gpuPicker.cpuSubtitle')"
        value="cpu"
        :selected="selected === 'cpu'"
        @click="pickGpu('cpu')"
      />
      <!-- Manual Install -->
      <HardwareOption
        placeholder-text="Manual Install"
        :subtitle="$t('install.gpuPicker.manualSubtitle')"
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
</style>
