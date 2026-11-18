<template>
  <SanitizedHtml
    class="comfy-markdown-content size-full min-h-16 overflow-y-auto rounded-lg contain-size"
    tabindex="0"
    data-capture-wheel="true"
    role="region"
    :html
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import SanitizedHtml from '@comfyorg/design-system/common/SanitizedHtml'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

const { markdown } = defineProps<{
  markdown: string
}>()

const html = computed(() => renderMarkdownToHtml(markdown))
</script>
