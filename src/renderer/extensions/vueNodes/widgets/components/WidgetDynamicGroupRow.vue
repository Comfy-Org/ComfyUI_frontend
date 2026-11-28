<template>
  <div class="flex items-center gap-2">
    <span class="h-px flex-1 bg-border" />
    <span>{{ widgetLabel(widgetId) }}</span>
    <Button
      variant="textonly"
      size="icon"
      class="size-6"
      :disabled="widgetOptions(widgetId).disabled"
      :aria-label="t('dynamicGroup.remove', { row: widgetLabel(widgetId) })"
      @click="removeRow"
    >
      <i class="icon-[lucide--x]" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import {
  widgetLabel,
  widgetName,
  widgetOptions
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

const { widgetId } = defineProps<{ widgetId: WidgetId }>()
const { t } = useI18n()
const emit = defineEmits<{
  'update:modelValue': [value: undefined]
  removed: [name: string]
}>()

function removeRow() {
  const name = widgetName(widgetId)
  emit('update:modelValue', undefined)
  emit('removed', name)
}
</script>
