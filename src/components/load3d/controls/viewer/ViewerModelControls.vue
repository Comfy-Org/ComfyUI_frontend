<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-2">
      <label>{{ $t('load3d.upDirection') }}</label>
      <Select v-model="upDirection">
        <SelectTrigger size="md">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in upDirectionOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="materialModes.length > 0" class="flex flex-col gap-2">
      <label>{{ $t('load3d.materialMode') }}</label>
      <Select v-model="materialMode">
        <SelectTrigger size="md">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in materialModeOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
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
