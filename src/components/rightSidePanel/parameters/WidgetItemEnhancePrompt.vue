<script setup lang="ts">
import type { WidgetId } from '@/types/widgetId'
import EnhancePromptButton from '@/workbench/extensions/agent/components/EnhancePromptButton.vue'
import { useEnhancePrompt } from '@/workbench/extensions/agent/composables/useEnhancePrompt'

const { widgetId } = defineProps<{
  widgetId?: WidgetId
}>()

const prompt = defineModel<string>({ required: true })

const { isLocked, isProcessing, enhance } = useEnhancePrompt({
  prompt,
  widgetId: () => widgetId
})
</script>

<template>
  <EnhancePromptButton
    size="icon"
    tooltip-side="bottom"
    :loading="isProcessing"
    :disabled="isLocked"
    @click="enhance"
  />
</template>
