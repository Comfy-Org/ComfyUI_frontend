<template>
  <div
    class="widget-expands widget-markdown relative w-full cursor-text"
    @click="startEditing"
  >
    <!-- Display mode: Rendered markdown -->
    <div
      class="comfy-markdown-content lod-toggle h-full min-h-[60px] w-full overflow-y-auto rounded-lg px-4 py-2 text-sm hover:bg-[var(--p-content-hover-background)]"
      :class="isEditing === false ? 'visible' : 'invisible'"
      v-html="renderedHtml"
    />

    <!-- Edit mode: Textarea -->
    <Textarea
      v-show="isEditing"
      ref="textareaRef"
      v-model="localValue"
      :aria-label="`${$t('g.edit')} ${widget.name || $t('g.markdown')} ${$t('g.content')}`"
      class="absolute inset-0 min-h-[60px] w-full resize-none"
      :pt="{
        root: {
          class: 'text-sm w-full h-full',
          onBlur: handleBlur
        }
      }"
      data-capture-wheel="true"
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
  if (isEditing.value) return

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
