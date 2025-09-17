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
      <!-- Apple Metal / NVIDIA -->
      <HardwareOption
        v-if="platform === 'darwin'"
        :image-path="'/assets/images/apple-mps-logo.png'"
        placeholder-text="Apple Metal"
        subtitle="Apple Metal"
        :value="'mps'"
        :selected="selected === 'mps'"
        :recommended="true"
        @click="pickGpu('mps')"
      />
      <HardwareOption
        v-else
        :image-path="'/assets/images/nvidia-logo.svg'"
        placeholder-text="NVIDIA"
        :subtitle="$t('install.gpuPicker.nvidiaSubtitle')"
        :value="'nvidia'"
        :selected="selected === 'nvidia'"
        :recommended="true"
        @click="pickGpu('nvidia')"
      />
      <!-- CPU -->
      <HardwareOption
        placeholder-text="CPU"
        :subtitle="$t('install.gpuPicker.cpuSubtitle')"
        :value="'cpu'"
        :selected="selected === 'cpu'"
        @click="pickGpu('cpu')"
      />
      <!-- Manual Install -->
      <HardwareOption
        placeholder-text="Manual Install"
        :subtitle="$t('install.gpuPicker.manualSubtitle')"
        :value="'unsupported'"
        :selected="selected === 'unsupported'"
        @click="pickGpu('unsupported')"
      />
    </div>

    <div class="pt-12 px-24 h-16">
      <div v-show="showRecommendedBadge" class="flex items-center gap-2">
        <Tag
          :value="$t('install.gpuPicker.recommended')"
          class="bg-neutral-300 text-neutral-900 rounded-full normal-case text-sm font-medium px-3"
        />
        <i-lucide:badge-check class="text-neutral-300 text-lg" />
      </div>
    </div>

    <!-- Description text at bottom -->
    <div class="text-neutral-300 px-24">
      <p v-show="descriptionText" class="leading-relaxed">
        {{ descriptionText }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TorchDeviceType } from '@comfyorg/comfyui-electron-types'
import Tag from 'primevue/tag'
import { computed } from 'vue'

import HardwareOption from '@/components/install/HardwareOption.vue'
import { st } from '@/i18n'
import { electronAPI } from '@/utils/envUtil'

const selected = defineModel<TorchDeviceType | null>('device', {
  required: true
})

const electron = electronAPI()
const platform = electron.getPlatform()

const showRecommendedBadge = computed(
  () => selected.value === 'mps' || selected.value === 'nvidia'
)

const descriptionKeys = {
  mps: 'appleMetal',
  nvidia: 'nvidia',
  cpu: 'cpu',
  unsupported: 'manual'
} as const

const descriptionText = computed(() => {
  const key = selected.value ? descriptionKeys[selected.value] : undefined
  return st(`install.gpuPicker.${key}Description`, '')
})

const pickGpu = (value: typeof selected.value) => {
  const newValue = selected.value === value ? null : value
  selected.value = newValue
}
</script>
