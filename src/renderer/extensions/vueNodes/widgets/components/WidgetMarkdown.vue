<template>
  <div
    class="widget-markdown relative w-full cursor-text"
    @click="startEditing"
  >
    <!-- Display mode: Rendered markdown -->
    <div
      class="comfy-markdown-content hover:bg-[var(--p-content-hover-background)] text-sm min-h-[60px] w-full rounded-lg px-4 py-2 overflow-y-auto lod-toggle"
      :class="isEditing === false ? 'visible' : 'invisible'"
      v-html="renderedHtml"
    />

    <!-- Edit mode: Textarea -->
    <Textarea
      v-show="isEditing"
      ref="textareaRef"
      v-model="localValue"
      :disabled="readonly"
      class="w-full min-h-[60px] absolute inset-0"
      :pt="{
        root: {
          class: 'text-sm w-full h-full',
          onBlur: handleBlur
        }
      }"
      @update:model-value="onChange"
      @click.stop
      @keydown.stop
    />
    <LODFallback />
  </div>
</template>

<script setup lang="ts">
import Textarea from 'primevue/textarea'
import { computed, nextTick, ref } from 'vue'

import { useStringWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import LODFallback from '../../components/LODFallback.vue'

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

.comfy-markdown-content:hover {
  background-color: var(--p-content-hover-background);
}
</style>
