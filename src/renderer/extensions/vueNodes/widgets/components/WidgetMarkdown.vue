<template>
  <div class="widget-markdown relative w-full" @dblclick="startEditing">
    <div
      class="comfy-markdown-content size-full min-h-[60px] overflow-y-auto rounded-lg text-sm"
      :class="isEditing ? 'invisible' : 'visible'"
      tabindex="0"
      data-capture-wheel="true"
      v-html="renderedHtml"
    />

    <Textarea
      v-show="isEditing"
      ref="textareaRef"
      v-model="modelValue"
      :aria-label="`${$t('g.edit')} ${widget.name || $t('g.markdown')} ${$t('g.content')}`"
      class="absolute inset-0 min-h-[60px] w-full resize-none text-sm"
      data-capture-wheel="true"
      @blur="handleBlur"
      @pointerdown.capture.stop
      @pointermove.capture.stop
      @pointerup.capture.stop
      @click.stop
      @keydown.stop
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import Textarea from '@/components/ui/textarea/Textarea.vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

const { widget } = defineProps<{
  widget: SimplifiedWidget<string>
}>()

const modelValue = defineModel<string>({ default: '' })

const isEditing = ref(false)
const textareaRef = ref<InstanceType<typeof Textarea>>()

const renderedHtml = computed(() =>
  renderMarkdownToHtml(modelValue.value || '')
)

async function startEditing() {
  if (isEditing.value || widget.options?.read_only) return

  isEditing.value = true
  await nextTick()

  textareaRef.value?.focus()
}

function handleBlur() {
  isEditing.value = false
}
</script>
