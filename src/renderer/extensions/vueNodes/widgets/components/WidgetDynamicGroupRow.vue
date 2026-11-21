<template>
  <div class="flex items-center gap-2">
    <span class="h-px flex-1 bg-border" />
    <span>{{ widget.label }}</span>
    <Button
      variant="textonly"
      size="icon"
      class="size-6"
      :disabled="widget.options?.disabled"
      :aria-label="t('dynamicGroup.remove', { row: widget.label })"
      @click="removeRow"
    >
      <i class="icon-[lucide--x]" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useWidgetView } from '@/renderer/extensions/vueNodes/widgets/useWidgetView'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

const { widgetId } = defineProps<{ widgetId: WidgetId }>()
const widget = useWidgetView(() => widgetId)
const { t } = useI18n()
const emit = defineEmits<{ removed: [name: string] }>()

function removeRow() {
  const name = widget.value.name
  widget.value.setValue(undefined)
  emit('removed', name)
}
</script>
