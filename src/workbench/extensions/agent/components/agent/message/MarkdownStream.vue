<script setup lang="ts">
import { marked } from 'marked'
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

const segments = computed<Segment[]>(() => {
  const out: Segment[] = []
  let prose = ''
  const flushProse = () => {
    if (!prose) return
    out.push({ type: 'prose', html: renderMarkdownToHtml(prose) })
    prose = ''
  }
  for (const token of marked.lexer(text)) {
    if (token.type === 'code' && token.codeBlockStyle !== 'indented') {
      flushProse()
      out.push({
        type: 'code',
        code: token.text,
        lang: token.lang?.split(/\s+/)[0] || 'text'
      })
    } else {
      prose += token.raw
    }
  }
  flushProse()
  return out
})

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
