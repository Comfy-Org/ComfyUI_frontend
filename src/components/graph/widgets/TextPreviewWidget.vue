<template>
  <div
    class="relative max-h-[200px] min-h-[28px] w-full overflow-y-auto rounded-lg px-4 py-2 text-xs"
  >
    <div class="flex items-center gap-2">
      <div class="flex flex-1 items-center gap-2 break-all">
        <span v-html="formattedText"></span>
        <Skeleton v-if="isParentNodeExecuting" class="h-4! flex-1!" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { default as DOMPurify } from 'dompurify'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, watch } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/litegraph'
import { useExecutionStore } from '@/stores/executionStore'
import { linkifyHtml, nl2br } from '@/utils/formatUtil'

const modelValue = defineModel<string>({ required: true })
const props = defineProps<{
  nodeId: NodeId
}>()

const executionStore = useExecutionStore()
const isParentNodeExecuting = computed(() => {
  if (executionStore.isIdle) return false
  if (!parentNodeId) return executionStore.executingNodeIds.length > 0
  return executionStore.executingNodeIds.includes(parentNodeId)
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

  // Keep current behavior (auto-link bare URLs + \n -> <br>)
  let html = nl2br(linkifyHtml(holed))

  // Restore placeholders as <a>...</a> (minimal escaping + http default)
  html = html.replace(/__LNK(\d+)__/g, (_m, i) => {
    const { label, url } = tokens[+i]
    const safeHref = url.replace(/"/g, '&quot;')
    const safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

let parentNodeId: NodeId | null = null
onMounted(() => {
  // Get the parent node ID from props if provided
  // For backward compatibility, fall back to the first executing node
  parentNodeId = props.nodeId ?? parentNodeId
})

// Lazily adopt the first executing node as the parent when no nodeId is known.
watch(
  () => executionStore.executingNodeIds,
  (ids) => {
    if (!parentNodeId && ids.length > 0) parentNodeId = ids[0]
  }
)
</script>
