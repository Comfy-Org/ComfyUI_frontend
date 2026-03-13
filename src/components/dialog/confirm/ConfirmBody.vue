<template>
  <div
    class="flex flex-col border-t border-border-default px-4 py-2 text-sm wrap-break-word text-muted-foreground"
  >
    <p v-if="promptTextReal" :class="preserveNewlines && 'whitespace-pre-line'">
      {{ promptTextReal }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

const { promptText, preserveNewlines = false } = defineProps<{
  promptText?: MaybeRefOrGetter<string>
  preserveNewlines?: boolean
}>()

const promptTextReal = computed(() => toValue(promptText))
</script>
