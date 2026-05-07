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
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'

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
