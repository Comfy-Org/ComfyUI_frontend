<template>
  <div class="wrap-break-word">
    <div v-if="!hasMarkdown" v-text="text" />
    <div v-else>
      <template v-for="(segment, index) in parsedSegments" :key="index">
        <a
          v-if="segment.type === 'link' && 'url' in segment"
          :href="segment.url"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline"
        >
          <span class="text-blue-600">{{ segment.text }}</span>
        </a>
        <strong v-else-if="segment.type === 'bold'">{{ segment.text }}</strong>
        <em v-else-if="segment.type === 'italic'">{{ segment.text }}</em>
        <code
          v-else-if="segment.type === 'code'"
          class="rounded-sm px-1 py-0.5 text-xs"
          >{{ segment.text }}</code
        >
        <span v-else>{{ segment.text }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { text } = defineProps<{
  text: string
}>()

type MarkdownSegment = {
  type: 'text' | 'link' | 'bold' | 'italic' | 'code'
  text: string
  url?: string
}

const hasMarkdown = computed(() => {
  const hasMarkdown =
    /(\[.*?\]\(.*?\)|(\*\*|__)(.*?)(\*\*|__)|(\*|_)(.*?)(\*|_)|`(.*?)`)/.test(
      text
    )
  return hasMarkdown
})

const parsedSegments = computed(() => {
  if (!hasMarkdown.value) return [{ type: 'text', text }]

  const segments: MarkdownSegment[] = []
  const remainingText = text
  let lastIndex: number = 0

  const linkRegex = /\[(.*?)\]\((.*?)\)/g
  let linkMatch: RegExpExecArray | null

  while ((linkMatch = linkRegex.exec(remainingText)) !== null) {
    if (linkMatch.index > lastIndex) {
      segments.push({
        type: 'text',
        text: remainingText.substring(lastIndex, linkMatch.index)
      })
    }

    segments.push({
      type: 'link',
      text: linkMatch[1],
      url: linkMatch[2]
    })

    lastIndex = linkMatch.index + linkMatch[0].length
  }

  if (lastIndex < remainingText.length) {
    let rest = remainingText.substring(lastIndex)

    rest = rest.replace(/(\*\*|__)(.*?)(\*\*|__)/g, (_, __, p2) => {
      segments.push({ type: 'bold', text: p2 })
      return ''
    })

    rest = rest.replace(/(\*|_)(.*?)(\*|_)/g, (_, __, p2) => {
      segments.push({ type: 'italic', text: p2 })
      return ''
    })

    rest = rest.replace(/`(.*?)`/g, (_, p1) => {
      segments.push({ type: 'code', text: p1 })
      return ''
    })

    if (rest) {
      segments.push({ type: 'text', text: rest })
    }
  }

  return segments
})
</script>
