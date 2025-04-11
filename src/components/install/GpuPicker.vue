<template>
  <div class="flex flex-col gap-6 w-[600px] h-[30rem] select-none">
    <!-- Installation Path Section -->
    <div class="grow flex flex-col gap-4 text-neutral-300">
      <h2 class="text-2xl font-semibold text-neutral-100">
        {{ $t('install.gpuSelection.selectGpu') }}
      </h2>

      <p class="m-1 text-neutral-400">
        {{ $t('install.gpuSelection.selectGpuDescription') }}:
      </p>

      <!-- GPU Selection buttons -->
      <div
        class="flex gap-2 text-center transition-opacity"
        :class="{ selected: selected }"
      >
        <!-- NVIDIA -->
        <div
          v-if="platform !== 'darwin'"
          class="gpu-button"
          :class="{ selected: selected === 'nvidia' }"
          role="button"
          @click="pickGpu('nvidia')"
        >
          <img
            class="m-12"
            alt="NVIDIA logo"
            width="196"
            height="32"
            src="/assets/images/nvidia-logo.svg"
          />
        </div>
        <!-- MPS -->
        <div
          v-if="platform === 'darwin'"
          class="gpu-button"
          :class="{ selected: selected === 'mps' }"
          role="button"
          @click="pickGpu('mps')"
        >
          <img
            class="rounded-lg hover-brighten"
            alt="Apple Metal Performance Shaders Logo"
            width="292"
            ratio
            src="/assets/images/apple-mps-logo.png"
          />
        </div>
        <!-- Manual configuration -->
        <div
          class="gpu-button"
          :class="{ selected: selected === 'unsupported' }"
          role="button"
          @click="pickGpu('unsupported')"
        >
          <img
            class="m-12"
            alt="Manual configuration"
            width="196"
            src="/assets/images/manual-configuration.svg"
          />
        </div>
      </div>

      <!-- Details on selected GPU -->
      <p v-if="selected === 'nvidia'" class="m-1">
        <Tag icon="pi pi-check" severity="success" :value="'CUDA'" />
        {{ $t('install.gpuSelection.nvidiaDescription') }}
      </p>

      <p v-if="selected === 'mps'" class="m-1">
        <Tag icon="pi pi-check" severity="success" :value="'MPS'" />
        {{ $t('install.gpuSelection.mpsDescription') }}
      </p>

      <div v-if="selected === 'unsupported'" class="text-neutral-300">
        <p class="m-1">
          <Tag
            icon="pi pi-exclamation-triangle"
            severity="warn"
            :value="t('icon.exclamation-triangle')"
          />
          {{ $t('install.gpuSelection.customSkipsPython') }}
        </p>

        <ul>
          <li>
            <strong>
              {{ $t('install.gpuSelection.customComfyNeedsPython') }}
            </strong>
          </li>
          <li>{{ $t('install.gpuSelection.customManualVenv') }}</li>
          <li>{{ $t('install.gpuSelection.customInstallRequirements') }}</li>
          <li>{{ $t('install.gpuSelection.customMayNotWork') }}</li>
        </ul>
      </div>

      <div v-if="selected === 'cpu'">
        <p class="m-1">
          <Tag
            icon="pi pi-exclamation-triangle"
            severity="warn"
            :value="t('icon.exclamation-triangle')"
          />
          {{ $t('install.gpuSelection.cpuModeDescription') }}
        </p>
        <p class="m-1">
          {{ $t('install.gpuSelection.cpuModeDescription2') }}
        </p>
      </div>
    </div>

    <div
      class="transition-opacity flex gap-3 h-0"
      :class="{
        'opacity-40': selected && selected !== 'cpu'
      }"
    >
      <ToggleSwitch
        v-model="cpuMode"
        input-id="cpu-mode"
        class="-translate-y-40"
      />
      <label for="cpu-mode" class="select-none">
        {{ $t('install.gpuSelection.enableCpuMode') }}
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TorchDeviceType } from '@comfyorg/comfyui-electron-types'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { electronAPI } from '@/utils/envUtil'

const { t } = useI18n()

const cpuMode = computed({
  get: () => selected.value === 'cpu',
  set: (value) => {
    selected.value = value ? 'cpu' : null
  }
})
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
  @apply w-1/2 m-0 cursor-pointer rounded-lg flex flex-col items-center justify-around bg-neutral-800 bg-opacity-50 hover:bg-opacity-75 transition-colors;

  &.selected {
    @apply opacity-100 bg-neutral-700 bg-opacity-50 hover:bg-opacity-60;
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
