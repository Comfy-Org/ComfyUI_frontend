<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

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

// Prose styles read from the deployed prototype's .agent-markdown rules.
const proseClass = cn(
  'text-agent-fg text-sm/relaxed',
  '[&_a]:text-agent-accent [&_a]:cursor-pointer [&_a]:underline',
  '[&_p]:my-0 [&_p]:pt-1 [&_strong]:font-semibold',
  '[&_h1]:mt-0 [&_h1]:pt-4 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-semibold',
  '[&_h2]:pt-3.5 [&_h2]:pb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:pt-2 [&_h3]:font-semibold',
  '[&_ol]:my-0 [&_ol]:list-decimal [&_ol]:pt-1 [&_ol]:pb-2 [&_ol]:pl-5',
  '[&_ul]:my-0 [&_ul]:list-disc [&_ul]:pt-1 [&_ul]:pb-2 [&_ul]:pl-5',
  '[&_:not(pre)>code]:bg-agent-surface-hover [&_:not(pre)>code]:border-agent-border-strong [&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:border [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.875em]',
  '[&_blockquote]:border-agent-border-strong [&_blockquote]:text-agent-fg-muted [&_blockquote]:my-2 [&_blockquote]:border-l-[3px] [&_blockquote]:py-1.5 [&_blockquote]:pl-3.5',
  '[&_table]:bg-agent-surface-raised [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg',
  '[&_th]:border-agent-border-strong [&_th]:bg-agent-surface-hover [&_th]:border-b [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border-agent-border-strong [&_td]:border-b [&_td]:px-4 [&_td]:py-2.5'
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
