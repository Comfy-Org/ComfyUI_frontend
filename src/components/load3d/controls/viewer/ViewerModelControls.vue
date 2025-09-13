<template>
  <div class="space-y-4">
    <div>
      <label>{{ t('load3d.upDirection') }}</label>
      <Select
        v-model="upDirection"
        :options="upDirectionOptions"
        option-label="label"
        option-value="value"
      />
    </div>

    <div>
      <label>{{ t('load3d.materialMode') }}</label>
      <Select
        v-model="materialMode"
        :options="materialModeOptions"
        option-label="label"
        option-value="value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'

import { MaterialMode, UpDirection } from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'

const upDirection = defineModel<UpDirection>('upDirection')
const materialMode = defineModel<MaterialMode>('materialMode')

const upDirectionOptions = [
  { label: t('load3d.upDirections.original'), value: 'original' },
  { label: '-X', value: '-x' },
  { label: '+X', value: '+x' },
  { label: '-Y', value: '-y' },
  { label: '+Y', value: '+y' },
  { label: '-Z', value: '-z' },
  { label: '+Z', value: '+z' }
]

const materialModeOptions = computed(() => {
  return [
    { label: t('load3d.materialModes.original'), value: 'original' },
    { label: t('load3d.materialModes.normal'), value: 'normal' },
    { label: t('load3d.materialModes.wireframe'), value: 'wireframe' }
  ]
})
</script>
