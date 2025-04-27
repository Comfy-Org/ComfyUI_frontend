<template>
  <div class="flex flex-col">
    <div class="relative show-export-formats">
      <Button
        class="p-button-rounded p-button-text"
        @click="toggleExportFormats"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.exportModel'),
            showDelay: 300
          }"
          class="pi pi-download text-white text-lg"
        />
      </Button>
      <div
        v-show="showExportFormats"
        class="absolute left-12 top-0 bg-black bg-opacity-50 rounded-lg shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="format in exportFormats"
            :key="format.value"
            class="p-button-text text-white"
            @click="exportModel(format.value)"
          >
            {{ format.label }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import { onMounted, onUnmounted, ref } from 'vue'

import { t } from '@/i18n'

const vTooltip = Tooltip

const emit = defineEmits<{
  (e: 'exportModel', format: string): void
}>()

const showExportFormats = ref(false)

const exportFormats = [
  { label: 'GLB', value: 'glb' },
  { label: 'OBJ', value: 'obj' },
  { label: 'STL', value: 'stl' }
]

const toggleExportFormats = () => {
  showExportFormats.value = !showExportFormats.value
}

const exportModel = (format: string) => {
  emit('exportModel', format)

  showExportFormats.value = false
}

const closeExportFormatsList = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-export-formats')) {
    showExportFormats.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeExportFormatsList)
})

onUnmounted(() => {
  document.removeEventListener('click', closeExportFormatsList)
})
</script>
