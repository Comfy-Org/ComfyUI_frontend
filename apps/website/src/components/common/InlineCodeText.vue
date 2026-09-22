<script setup lang="ts">
import { splitInlineCode } from '../../lib/inline-code'

const { text } = defineProps<{ text: string }>()
</script>

<template>
  <template v-for="(part, index) in splitInlineCode(text)" :key="index"
    ><code
      v-if="part.code"
      class="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-2xs text-primary-comfy-canvas lg:text-sm"
      >{{ part.text }}</code
    ><template v-else>{{ part.text }}</template></template
  >
</template>
