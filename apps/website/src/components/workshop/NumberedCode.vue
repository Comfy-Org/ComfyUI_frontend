<script setup lang="ts">
import type { HighlightToken } from '@/lib/highlight'

const {
  lines,
  firstLine,
  endsCode = true
} = defineProps<{
  lines: readonly (readonly HighlightToken[])[]
  firstLine: number
  endsCode?: boolean
}>()

const lineBreak = (index: number) =>
  endsCode && index === lines.length - 1 ? '' : '\n'
</script>

<template>
  <code
    class="block w-max min-w-full font-mono whitespace-pre"
    :style="{ counterReset: `line ${firstLine - 1}` }"
  >
    <span
      v-for="(line, index) in lines"
      :key="index"
      class="block [counter-increment:line] before:me-4 before:inline-block before:w-8 before:text-end before:text-primary-warm-gray/70 before:content-[counter(line)] before:select-none"
      ><span
        v-for="(token, tokenIndex) in line"
        :key="tokenIndex"
        :style="{ color: token.color }"
        >{{ token.content }}</span
      >{{ lineBreak(index) }}</span
    >
  </code>
</template>
