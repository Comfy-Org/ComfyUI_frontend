<template>
  <WidgetLayoutField :widget>
    <div class="flex flex-col gap-2 w-full">
      <Select
        v-model="localValue"
        :options="selectOptions"
        :disabled="readonly"
        class="w-full text-xs"
        size="small"
        @update:model-value="onSelectChange"
      />

      <!-- Upload button (minimal UI) -->
      <Button
        type="button"
        size="small"
        severity="secondary"
        :disabled="readonly"
        @click="openUpload"
      >
        {{ $t('upload') }}
      </Button>

      <!-- Preview intentionally omitted; NodeContent handles previews universally -->
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { type Ref, computed, inject, unref } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ResultItemType } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { useComboBackedOptions } from '../composables/useComboBackedOptions'
import { useWidgetImageUpload } from '../composables/useWidgetImageUpload'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | string[]>
  modelValue: string | string[] | undefined
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | undefined]
}>()

const nodeId = inject<string | Ref<string>>('nodeId')
const node = computed<LGraphNode | undefined>(() => {
  // Use unref to handle both regular values and refs
  const actualNodeId = unref(nodeId)
  const id = Number(actualNodeId)
  const currentGraph = app.canvas.graph || app.graph
  return (currentGraph?.getNodeById?.(id) as LGraphNode | null) || undefined
})

// Extract options
const options = computed(
  () => (props.widget.options ?? {}) as Record<string, any>
)
const allowBatch = computed<boolean>(() => options.value.allow_batch === true)
// Animated flag is stored on widget options for downstream consumers if needed
const folder = computed<ResultItemType>(
  () => options.value.image_folder ?? 'input'
)

// Use widget value helper (string or string[])
const { localValue } = useWidgetValue<
  string | string[],
  string | string[] | undefined
>({
  widget: props.widget as SimplifiedWidget<string | string[]>,
  modelValue: (props.modelValue as string | string[]) ?? '',
  defaultValue: allowBatch.value ? ([] as string[]) : '',
  emit
})

const { selectOptions, addOptions } = useComboBackedOptions({
  nodeRef: node,
  widgetName: props.widget.name
})

const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp'
const { open: openUpload } = useWidgetImageUpload({
  nodeRef: node,
  allowBatch,
  folder,
  accept: ACCEPTED_IMAGE_TYPES,
  onUploaded: (paths) => {
    addOptions(paths)
    const newValue = allowBatch.value ? paths : paths[0]
    emit('update:modelValue', newValue)
  }
})

function onSelectChange(value: string | string[] | undefined) {
  if (value == null) return
  emit('update:modelValue', value)
}
</script>

<style scoped></style>
