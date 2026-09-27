<script setup lang="ts">
import { marked } from 'marked'
import { computed, defineAsyncComponent, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { api } from '@/scripts/api'
import type { ResultItemImpl } from '@/stores/queueStore'
import {
  renderMarkdownToHtml,
  resolveMarkdownUrl
} from '@/utils/markdownRendererUtil'

import type { ReplyAsset } from '../../../utils/replyAssets'
import {
  classifyAssetUrl,
  replyAssetResultItem,
  tokenReplyAssets
} from '../../../utils/replyAssets'
import CodeBlock from './CodeBlock.vue'
import ReplyAssetGroup from './ReplyAssetGroup.vue'

const { text } = defineProps<{ text: string }>()
const apiBaseUrl = new URL(api.apiURL(''), window.location.origin).href
const normalizedBase = apiBaseUrl.replace(/\/+$/, '')

interface ProseSegment {
  type: 'prose'
  html: string
}
interface CodeSegment {
  type: 'code'
  code: string
  lang: string
}
interface AssetsSegment {
  type: 'assets'
  assets: ReplyAsset[]
}
type Segment = ProseSegment | CodeSegment | AssetsSegment

const segments = computed<Segment[]>(() => {
  const out: Segment[] = []
  let prose = ''
  const flushProse = () => {
    if (!prose) return
    out.push({
      type: 'prose',
      html: renderMarkdownToHtml(prose, apiBaseUrl)
    })
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
      continue
    }
    const assets = tokenReplyAssets(token)
    if (assets) {
      flushProse()
      const resolved = assets.map((asset) => ({
        ...asset,
        url: resolveMarkdownUrl(asset.url, normalizedBase)
      }))
      const prev = out.at(-1)
      if (prev?.type === 'assets') prev.assets.push(...resolved)
      else out.push({ type: 'assets', assets: resolved })
    } else {
      prose += token.raw
    }
  }
  flushProse()
  return out
})

const MediaLightbox = defineAsyncComponent(
  () => import('@/components/sidebar/tabs/queue/MediaLightbox.vue')
)

const proseItems = ref<ResultItemImpl[]>([])
const proseIndex = ref(-1)

function onProseClick(event: MouseEvent): void {
  const image = event.target
  if (!(image instanceof HTMLImageElement)) return
  const asset = classifyAssetUrl(image.src) ?? {
    url: image.src,
    filename: image.alt || 'image',
    kind: 'image' as const
  }
  proseItems.value = [replyAssetResultItem({ ...asset, kind: 'image' })]
  proseIndex.value = 0
}

const proseClass = cn(
  'text-agent-fg text-sm wrap-break-word',
  '[&_img]:mt-2 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:cursor-pointer [&_img]:object-contain',
  '[&_a]:text-agent-accent [&_a]:cursor-pointer [&_a]:underline',
  '[&_p]:my-0 [&_p]:pt-4 [&_p:first-child]:pt-0 [&_strong]:font-semibold',
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
  <div data-testid="markdown-stream" class="max-w-full min-w-0">
    <template v-for="(segment, index) in segments" :key="index">
      <CodeBlock
        v-if="segment.type === 'code'"
        :code="segment.code"
        :lang="segment.lang"
      />
      <ReplyAssetGroup
        v-else-if="segment.type === 'assets'"
        :assets="segment.assets"
      />
      <div
        v-else
        :class="proseClass"
        @click="onProseClick"
        v-html="segment.html"
      />
    </template>
    <MediaLightbox
      v-if="proseIndex !== -1"
      :all-gallery-items="proseItems"
      :active-index="proseIndex"
      @update:active-index="proseIndex = $event"
    />
  </div>
</template>
