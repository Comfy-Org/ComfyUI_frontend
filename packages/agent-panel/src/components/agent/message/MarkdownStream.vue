<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/cn'
import { renderMarkdownToHtml } from '@/utils/agent/renderMarkdownToHtml'

import CodeBlock from './CodeBlock.vue'

const { text, raw = false } = defineProps<{
  text: string
  raw?: boolean
}>()

interface ProseSegment {
  type: 'prose'
  html: string
}
interface CodeSegment {
  type: 'code'
  code: string
  lang: string
}
type Segment = ProseSegment | CodeSegment

// Fenced code blocks are pulled out so they render as shiki-highlighted CodeBlocks with
// copy chrome; the prose between them goes through the sanitizing markdown renderer. The
// opening fence must start a line (lookbehind for start-or-newline) so an inline
// triple-backtick span mid-sentence is left to the markdown renderer, not misparsed as a
// block. NOTE(migration): 4+ backtick fences still need a marked.lexer-based split.
const FENCE = /(?<=^|\n)```([\w-]*)\n([\s\S]*?)```/g

const segments = computed<Segment[]>(() => {
  const out: Segment[] = []
  let last = 0
  for (const match of text.matchAll(FENCE)) {
    const idx = match.index ?? 0
    if (idx > last) {
      out.push({
        type: 'prose',
        html: renderMarkdownToHtml(text.slice(last, idx))
      })
    }
    out.push({
      type: 'code',
      code: match[2].replace(/\n$/, ''),
      lang: match[1] || 'text'
    })
    last = idx + match[0].length
  }
  if (last < text.length) {
    out.push({ type: 'prose', html: renderMarkdownToHtml(text.slice(last)) })
  }
  return out
})

const proseClass = cn(
  'text-agent-fg text-sm/relaxed',
  '[&_a]:text-agent-accent [&_a]:underline [&_p]:my-1.5',
  '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_:not(pre)>code]:bg-agent-surface [&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-xs',
  '[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold',
  '[&_blockquote]:border-agent-border [&_blockquote]:text-agent-fg-muted [&_blockquote]:border-l-2 [&_blockquote]:pl-3'
)
</script>

<template>
  <pre
    v-if="raw"
    class="rounded-agent bg-agent-surface text-agent-fg overflow-x-auto p-3 text-xs whitespace-pre-wrap"
    >{{ text }}</pre
  >
  <div v-else>
    <template v-for="(segment, index) in segments" :key="index">
      <CodeBlock
        v-if="segment.type === 'code'"
        :code="segment.code"
        :lang="segment.lang"
      />
      <div v-else :class="proseClass" v-html="segment.html" />
    </template>
  </div>
</template>
