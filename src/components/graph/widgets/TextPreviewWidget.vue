<template>
  <div
    class="relative max-h-[200px] min-h-[28px] w-full overflow-y-auto rounded-lg px-4 py-2 text-xs"
  >
    <div class="flex items-center gap-2">
      <div class="flex flex-1 items-center gap-2 break-all">
        <SanitizedHtml as="span" :html="formattedText" />
        <Skeleton v-if="isParentNodeExecuting" class="h-4! flex-1!" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { default as DOMPurify } from 'dompurify'
import Skeleton from 'primevue/skeleton'
import { computed } from 'vue'

import SanitizedHtml from '@/components/common/SanitizedHtml.vue'
import { useExecutionStore } from '@/stores/executionStore'
import type { NodeId } from '@/types/nodeId'
import { linkifyHtml, nl2br } from '@/utils/formatUtil'
import { escapeHtml } from '@/utils/htmlEscape'

const modelValue = defineModel<string>({ required: true })
const props = defineProps<{
  nodeId: NodeId
}>()

const executionStore = useExecutionStore()
const isParentNodeExecuting = computed(() => {
  if (executionStore.isIdle) return false
  return executionStore.executingNodeIds.includes(props.nodeId)
})
const formattedText = computed(() => {
  const src = modelValue.value
  // Turn [[label|url]] into placeholders to avoid interfering with linkifyHtml
  const tokens: { label: string; url: string }[] = []
  const holed = src.replace(
    /\[\[([^|\]]+)\|([^\]]+)\]\]/g,
    (_m, label, url) => {
      tokens.push({ label: String(label), url: String(url) })
      return `__LNK${tokens.length - 1}__`
    }
  )

  // Escape HTML-significant characters BEFORE linkifying so bracket-delimited
  // text that looks like a tag (e.g. `<lora:my_style_v2:0.8>`) displays
  // literally instead of being parsed as markup and dropped. linkifyHtml only
  // matches http(s)/ftp/file/www URLs, none of which contain the escaped
  // entities, so escaping first doesn't stop real URLs from being linkified.
  // Keep current behavior otherwise (auto-link bare URLs + \n -> <br>).
  let html = nl2br(linkifyHtml(escapeHtml(holed)))

  // Restore placeholders as <a>...</a> (escape label/url for safety)
  html = html.replace(/__LNK(\d+)__/g, (_m, i) => {
    const { label, url } = tokens[+i]
    const safeHref = escapeHtml(url)
    const safeLabel = escapeHtml(label)
    return /^https?:\/\//i.test(url)
      ? `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`
      : safeLabel
  })

  // Strict allowlist: this widget only needs anchors and line breaks. Raw
  // websocket progress text flows into modelValue, so we drop every other
  // tag (img, script, iframe, etc.) to keep the v-html trust boundary tight.
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  })
})
</script>
