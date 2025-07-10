<template>
  <Select
    v-model="exportFormat"
    :options="exportFormats"
    option-label="label"
    option-value="value"
  >
  </Select>

  <Button
    class="p-button-rounded p-button-text"
    @click="exportModel(exportFormat)"
  >
    {{ t('load3d.export') }}
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { ref } from 'vue'

import { t } from '@/i18n'

const emit = defineEmits<{
  (e: 'exportModel', format: string): void
}>()

const exportFormats = [
  { label: 'GLB', value: 'glb' },
  { label: 'OBJ', value: 'obj' },
  { label: 'STL', value: 'stl' }
]

const exportFormat = ref('obj')

const exportModel = (format: string) => {
  emit('exportModel', format)
}
</script>
