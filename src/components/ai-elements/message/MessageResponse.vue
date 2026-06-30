<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import Response from '@/components/ai-elements/response/Response.vue'

const { content, class: className } = defineProps<{
  content?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <Response :content="content" :class="className">
    <slot />
  </Response>
</template>
