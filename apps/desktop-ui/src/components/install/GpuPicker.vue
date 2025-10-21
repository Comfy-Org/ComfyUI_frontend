<template>
  <div
    class="mx-auto grid h-[40rem] w-full max-w-3xl grid-rows-[1fr_auto_auto_1fr] select-none"
  >
    <h2 class="text-center font-inter text-3xl font-bold text-neutral-100">
      {{ $t('install.gpuPicker.title') }}
    </h2>

    <!-- GPU Selection buttons - takes up remaining space and centers content -->
    <div class="flex flex-1 items-center justify-center gap-8">
      <!-- Apple Metal / NVIDIA -->
      <HardwareOption
        v-if="platform === 'darwin'"
        :image-path="'./assets/images/apple-mps-logo.png'"
        placeholder-text="Apple Metal"
        subtitle="Apple Metal"
        :value="'mps'"
        :selected="selected === 'mps'"
        :recommended="true"
        @click="pickGpu('mps')"
      />
      <HardwareOption
        v-else
        :image-path="'./assets/images/nvidia-logo-square.jpg'"
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

    <div class="h-16 px-24 pt-12">
      <div v-show="showRecommendedBadge" class="flex items-center gap-2">
        <Tag
          :value="$t('install.gpuPicker.recommended')"
          class="rounded-full bg-neutral-300 px-2 py-[1px] text-sm font-bold text-neutral-900"
        />
        <i class="icon-[lucide--badge-check] text-lg text-neutral-300" />
      </div>
    </div>

    <div class="px-24 text-neutral-300">
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

const pickGpu = (value: TorchDeviceType) => {
  selected.value = value
}
</script>
