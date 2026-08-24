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

import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import { getExportFormatOptions } from '@/extensions/core/load3d/constants'

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
