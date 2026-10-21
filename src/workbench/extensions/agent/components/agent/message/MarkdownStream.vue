<script setup lang="ts">
import { marked } from 'marked'
import type { Token, Tokens } from 'marked'
import { computed, defineAsyncComponent, ref } from 'vue'

import SanitizedHtml from '@/components/common/SanitizedHtml.vue'
import { api } from '@/scripts/api'
import type { AugmentedResultItem } from '@/utils/resultItem'
import {
  renderMarkdownToHtml,
  resolveMarkdownUrl
} from '@/utils/markdownRendererUtil'

import type { ReplyAsset } from '@/workbench/extensions/agent/utils/replyAssets'
import {
  classifyAssetUrl,
  replyAssetResultItem,
  rewriteAgentAssetHtml,
  tokenReplyAssets
} from '@/workbench/extensions/agent/utils/replyAssets'
import CodeBlock from './CodeBlock.vue'
import ReplyAssetGroup from './ReplyAssetGroup.vue'

const { text } = defineProps<{
  text: string
}>()
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

function isFencedCode(token: Token): token is Tokens.Code {
  return token.type === 'code' && token.codeBlockStyle !== 'indented'
}

function pushAssets(out: Segment[], assets: ReplyAsset[]): void {
  const prev = out.at(-1)
  if (prev?.type === 'assets') prev.assets.push(...assets)
  else out.push({ type: 'assets', assets })
}

const segments = computed<Segment[]>(() => {
  const out: Segment[] = []
  let prose = ''
  const flushProse = () => {
    // A run of only blank-line ("space") tokens between two asset blocks
    // (e.g. two bare images joined by AgentMessageGroup.vue's `\n\n`) has no
    // visible content: dropping it here, instead of emitting an empty prose
    // segment, keeps the surrounding assets adjacent so pushAssets can still
    // merge them into one grid.
    if (!prose.trim()) {
      prose = ''
      return
    }
    out.push({
      type: 'prose',
      html: rewriteAgentAssetHtml(renderMarkdownToHtml(prose, apiBaseUrl))
    })
    prose = ''
  }
  for (const token of marked.lexer(text)) {
    if (isFencedCode(token)) {
      flushProse()
      out.push({
        type: 'code',
        code: token.text,
        lang: token.lang?.split(/\s+/)[0] || 'text'
      })
      continue
    }
    const assets = tokenReplyAssets(token)
    if (!assets) {
      prose += token.raw
      continue
    }
    const resolved = assets.map((asset) => ({
      ...asset,
      url: resolveMarkdownUrl(asset.url, normalizedBase)
    }))
    flushProse()
    pushAssets(out, resolved)
  }
  flushProse()
  return out
})

const MediaLightbox = defineAsyncComponent(
  () => import('@/components/sidebar/tabs/queue/MediaLightbox.vue')
)

const proseItems = ref<AugmentedResultItem[]>([])
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
      <SanitizedHtml
        v-else
        class="comfy-markdown-content text-foreground [--comfy-textarea-font-size:var(--text-sm)] [&_img]:cursor-pointer"
        :html="segment.html"
        @click="onProseClick"
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
