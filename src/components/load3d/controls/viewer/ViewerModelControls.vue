<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-2">
      <label>{{ $t('load3d.upDirection') }}</label>
      <Select
        v-model="upDirection"
        :options="upDirectionOptions"
        option-label="label"
        option-value="value"
      />
    </div>

    <div v-if="materialModes.length > 0" class="flex flex-col gap-2">
      <label>{{ $t('load3d.materialMode') }}</label>
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
import { useI18n } from 'vue-i18n'

import type {
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'

const { t } = useI18n()
const { materialModes = ['original', 'normal', 'wireframe'] } = defineProps<{
  materialModes?: readonly MaterialMode[]
}>()

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

const materialModeOptions = computed(() =>
  materialModes.map((mode) => ({
    label: t(`load3d.materialModes.${mode}`),
    value: mode
  }))
)
</script>
