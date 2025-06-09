<template>
  <div class="w-full px-2">
    <!-- Single line text input -->
    <InputText
      v-if="!isMultiline"
      v-model="modelValue"
      :placeholder="placeholder"
      class="w-full rounded-lg px-3 py-2 text-sm"
    />

    <!-- Multi-line textarea -->
    <Textarea
      v-else
      v-model="modelValue"
      :placeholder="placeholder"
      :auto-resize="true"
      :rows="3"
      class="w-full rounded-lg px-3 py-2 text-sm resize-none"
    />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'

import type { StringInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComponentWidget } from '@/scripts/domWidget'

const modelValue = defineModel<string>({ required: true })
const { widget } = defineProps<{
  widget: ComponentWidget<string>
}>()

const inputSpec = widget.inputSpec as StringInputSpec
const isMultiline = computed(() => inputSpec.multiline === true)
const placeholder = computed(
  () =>
    inputSpec.placeholder ??
    inputSpec.default ??
    inputSpec.defaultVal ??
    inputSpec.name
)
</script>
