<template>
  <div class="widget-markdown relative w-full" @dblclick="startEditing">
    <MarkdownView
      :class="isEditing ? 'invisible' : 'visible'"
      :aria-label="widgetName(widgetId) || $t('g.markdown')"
      :markdown="modelValue"
    />

    <Textarea
      v-if="isEditing"
      ref="textareaRef"
      v-model="modelValue"
      :aria-label="`${$t('g.edit')} ${widgetName(widgetId) || $t('g.markdown')} ${$t('g.content')}`"
      class="absolute inset-0 min-h-[60px] resize-none font-mono text-(length:--comfy-textarea-font-size)"
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
import { nextTick, ref } from 'vue'

import Textarea from '@comfyorg/design-system/textarea/Textarea'

import {
  widgetName,
  widgetOptions
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import MarkdownView from './MarkdownView.vue'

const { widgetId } = defineProps<{
  widgetId: WidgetId
}>()

const modelValue = defineModel<string>({ default: '' })

const isEditing = ref(false)
const textareaRef = ref<InstanceType<typeof Textarea>>()

async function startEditing() {
  if (isEditing.value || widgetOptions(widgetId).read_only) return

  isEditing.value = true
  await nextTick()

  textareaRef.value?.focus()
}

function handleBlur() {
  isEditing.value = false
}
</script>
