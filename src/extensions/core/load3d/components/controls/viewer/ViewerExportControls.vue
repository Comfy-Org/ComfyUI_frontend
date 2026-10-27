<template>
  <div class="space-y-4">
    <Select v-model="exportFormat">
      <SelectTrigger size="md">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="fmt in exportFormats"
          :key="fmt.value"
          :value="fmt.value"
        >
          {{ fmt.label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <Button
      variant="muted-textonly"
      class="rounded-full"
      @click="exportModel(exportFormat)"
    >
      {{ $t('load3d.export') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Select from '@comfyorg/design-system/select/Select'
import SelectContent from '@comfyorg/design-system/select/SelectContent'
import SelectItem from '@comfyorg/design-system/select/SelectItem'
import SelectTrigger from '@comfyorg/design-system/select/SelectTrigger'
import SelectValue from '@comfyorg/design-system/select/SelectValue'
import { getExportFormatOptions } from '@comfyorg/viewport3d/load3d/constants'

const { sourceFormat = null } = defineProps<{
  sourceFormat?: string | null
}>()

const emit = defineEmits<{
  (e: 'exportModel', format: string): void
}>()

const exportFormats = computed(() => getExportFormatOptions(sourceFormat))

const exportFormat = ref('obj')

watch(
  exportFormats,
  (formats) => {
    if (!formats.some((fmt) => fmt.value === exportFormat.value)) {
      exportFormat.value = formats[0]?.value ?? ''
    }
  },
  { immediate: true }
)

const exportModel = (format: string) => {
  emit('exportModel', format)
}
</script>
