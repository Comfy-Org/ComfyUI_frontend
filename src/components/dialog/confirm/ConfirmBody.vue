<template>
  <div
    class="flex flex-col border-t border-border-default p-4 text-sm/5 wrap-break-word text-muted-foreground"
  >
    <p
      v-if="promptTextReal"
      :class="cn('m-0', preserveNewlines && 'whitespace-pre-line')"
    >
      {{ promptTextReal }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { promptText, preserveNewlines = false } = defineProps<{
  promptText?: MaybeRefOrGetter<string>
  preserveNewlines?: boolean
}>()

const promptTextReal = computed(() => toValue(promptText))
</script>
