<template>
  <div class="flex flex-col gap-6 w-[600px] select-none">
    <!-- Installation Path Section -->
    <div class="flex flex-col gap-4">
      <h2 class="text-2xl font-semibold text-neutral-100">
        {{ $t('install.selectGpu') }}
      </h2>

      <p class="text-neutral-400 my-0">
        {{ $t('install.selectGpuDescription') }}
      </p>

      <div
        class="flex gap-2 text-center transition-opacity"
        :class="{ selected: selected }"
      >
        <img
          class="gpu-button"
          :class="{ selected: selected === 'nvidia' }"
          alt="NVIDIA logo"
          width="128"
          height="128"
          @click="pickGpu('nvidia')"
          src="/assets/images/nvidia-logo.svg"
        />
        <img
          class="gpu-button"
          :class="{ selected: selected === 'mps' }"
          alt="AMD"
          width="128"
          height="128"
          @click="pickGpu('mps')"
          src="/assets/images/amd-header-logo.svg"
        />
      </div>
    </div>

    <!-- System Paths Info -->
    <Accordion
      class="transition-opacity"
      :class="{
        'opacity-40': selected && selected !== 'cpu'
      }"
      ref="accordion"
    >
      <AccordionPanel value="0" class="rounded-lg">
        <AccordionHeader
          class="bg-neutral-900"
          :class="{ disabled: selected }"
          >{{ $t('install.cpuMode') }}</AccordionHeader
        >
        <AccordionContent :class="{ 'pointer-events-auto': selected }">
          <p class="my-2 text-neutral-300">
            <Tag
              icon="pi pi-exclamation-triangle"
              severity="warn"
              :value="t('icon.exclamation-triangle')"
            ></Tag>
            {{ $t('install.cpuModeDescription') }}
          </p>
          <p class="my-2 text-neutral-300">
            {{ $t('install.cpuModeDescription2') }}
          </p>
          <div class="mt-4 flex gap-3">
            <ToggleSwitch
              v-model="cpuMode"
              inputId="cpu-mode"
              @change="pickCpu"
            />
            <label for="cpu-mode" class="select-none"> Enable CPU Mode</label>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>
</template>

<script setup lang="ts">
import { computed, GlobalComponents, ref } from 'vue'
import { electronAPI, GpuType } from '@/utils/envUtil'

import ToggleSwitch from 'primevue/toggleswitch'

import Tag from 'primevue/tag'

import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'

import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const accordion = ref(null)

const cpuMode = computed({
  get: () => selected.value === 'cpu',
  set: () => pickGpu('cpu')
})
const selected = defineModel<GpuType>('gpu', {
  required: true
})

const electron = electronAPI()

const pickGpu = (value: typeof selected.value) => {
  const newValue = selected.value === value ? null : value
  selected.value = newValue
  if (newValue && newValue !== 'cpu') accordion.value.updateValue(null)
}

const pickCpu = () => {
  selected.value = selected.value === 'cpu' ? null : 'cpu'
}
</script>

<style lang="postcss">
.p-accordioncontent-content {
  @apply bg-neutral-900 rounded-lg transition-colors;
}

div.selected {
  .gpu-button:not(.selected) {
    @apply opacity-50 hover:opacity-100;
  }
}

.gpu-button {
  @apply grow flex flex-col items-stretch justify-stretch cursor-pointer rounded-lg p-12 bg-neutral-800 bg-opacity-50 hover:bg-opacity-75 transition-colors;

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
