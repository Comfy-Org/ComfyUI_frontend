<template>
  <div
    class="widget-markdown relative w-full cursor-text"
    @click="startEditing"
  >
    <!-- Display mode: Rendered markdown -->
    <div
      v-if="!isEditing"
      class="comfy-markdown-content text-xs min-h-[60px] rounded-lg px-4 py-2 overflow-y-auto"
      v-html="renderedHtml"
    />

    <!-- Edit mode: Textarea -->
    <Textarea
      v-else
      ref="textareaRef"
      v-model="localValue"
      :disabled="readonly"
      class="w-full text-xs"
      size="small"
      :rows="6"
      :pt="{
        root: {
          onBlur: handleBlur
        }
      }"
      @update:model-value="onChange"
      @click.stop
      @keydown.stop
    />
  </div>
</template>

<script setup lang="ts">
import Textarea from 'primevue/textarea'
import { computed, nextTick, ref } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

const props = defineProps<{
  widget: SimplifiedWidget<string>
  modelValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// State
const isEditing = ref(false)
const textareaRef = ref<InstanceType<typeof Textarea> | undefined>()

// Use the composable for consistent widget value handling
const { localValue, onChange } = useStringWidgetValue(
  props.widget,
  props.modelValue,
  emit
)

// Computed
const renderedHtml = computed(() => {
  return renderMarkdownToHtml(localValue.value || '')
})

// Methods
const startEditing = async () => {
  if (props.readonly || isEditing.value) return

  isEditing.value = true
  await nextTick()

  // Focus the textarea
  // @ts-expect-error - $el is an internal property of the Textarea component
  textareaRef.value?.$el?.focus()
}

const handleBlur = () => {
  isEditing.value = false
}
</script>

<style scoped>
.widget-markdown {
  background-color: var(--p-muted-color);
  border: 1px solid var(--p-border-color);
  border-radius: var(--p-border-radius);
}

.widget-markdown:hover:not(:has(textarea)) {
  background-color: var(--p-content-hover-background);
}
</style>
