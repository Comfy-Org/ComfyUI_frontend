<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import CodeBlock from '../code-block/CodeBlock.vue'
import CodeBlockActions from '../code-block/CodeBlockActions.vue'
import CodeBlockCopyButton from '../code-block/CodeBlockCopyButton.vue'
import CodeBlockFilename from '../code-block/CodeBlockFilename.vue'
import CodeBlockHeader from '../code-block/CodeBlockHeader.vue'
import CodeBlockTitle from '../code-block/CodeBlockTitle.vue'

const { content, class: className } = defineProps<{
  content: string
  class?: HTMLAttributes['class']
}>()

// Matches complete fenced code blocks: ```lang\n...content...\n```
const FENCE_RE = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm

// Matches an opening fence with no closing fence — used to detect mid-stream blocks.
// Captures: [1] newline-or-start before the fence, [2] language info, [3] code content so far.
const OPEN_FENCE_RE = /(^|\n)```([^\n]*)\n([\s\S]*)$/

interface HtmlSegment {
  type: 'html'
  key: string
  html: string
}

interface CodeSegment {
  type: 'code'
  key: string
  code: string
  language: string
  filename: string
}

type Segment = HtmlSegment | CodeSegment

function parseCodeInfo(info: string): { language: string; filename: string } {
  const colonIdx = info.indexOf(':')
  return {
    language: colonIdx >= 0 ? info.slice(0, colonIdx) : info,
    filename: colonIdx >= 0 ? info.slice(colonIdx + 1) : ''
  }
}

const segments = computed<Segment[]>(() => {
  if (!content) return []

  const result: Segment[] = []
  let lastIdx = 0
  let keyIdx = 0

  for (const match of content.matchAll(FENCE_RE)) {
    const before = content.slice(lastIdx, match.index)
    if (before) {
      result.push({
        type: 'html',
        key: `h${keyIdx++}`,
        html: renderMarkdownToHtml(before)
      })
    }

    const { language, filename } = parseCodeInfo(match[1].trim())
    result.push({
      type: 'code',
      key: `c${keyIdx++}`,
      code: match[2].replace(/\n$/, ''),
      language,
      filename
    })

    lastIdx = match.index! + match[0].length
  }

  const tail = content.slice(lastIdx)

  const openMatch = tail.match(OPEN_FENCE_RE)
  if (openMatch) {
    const fenceStart = openMatch.index! + openMatch[1].length
    const before = tail.slice(0, fenceStart)
    if (before) {
      result.push({
        type: 'html',
        key: `h${keyIdx++}`,
        html: renderMarkdownToHtml(before)
      })
    }
    const { language, filename } = parseCodeInfo(openMatch[2].trim())
    result.push({
      type: 'code',
      key: `c${keyIdx}`,
      code: openMatch[3],
      language,
      filename
    })
  } else if (tail) {
    result.push({
      type: 'html',
      key: `h${keyIdx}`,
      html: renderMarkdownToHtml(tail)
    })
  }

  return result
})
</script>

<template>
  <div :class="cn('agent-markdown', className)">
    <template v-for="segment in segments" :key="segment.key">
      <div
        v-if="segment.type === 'html'"
        class="contents"
        v-html="segment.html"
      />
      <CodeBlock
        v-else
        class="mb-2"
        :code="segment.code"
        :language="segment.language"
      >
        <CodeBlockHeader>
          <CodeBlockTitle>
            <i
              :class="
                segment.filename
                  ? 'icon-[lucide--file-code]'
                  : 'icon-[lucide--code-2]'
              "
              class="size-3.5 shrink-0"
            />
            <CodeBlockFilename v-if="segment.filename">
              {{ segment.filename }}
            </CodeBlockFilename>
            <span v-else class="font-mono text-xs">
              {{ segment.language || 'plaintext' }}
            </span>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    </template>
  </div>
</template>
