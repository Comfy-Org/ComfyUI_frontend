<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useMutationObserver } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import AttachmentAction from '@/components/ui/attachment/AttachmentAction.vue'
import AttachmentActions from '@/components/ui/attachment/AttachmentActions.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import AgentNodeChip from './AgentNodeChip.vue'

const { nodes, graphNodes } = defineProps<{
  nodes: LGraphNode[]
  graphNodes: LGraphNode[]
}>()

const emit = defineEmits<{
  remove: [node: LGraphNode]
}>()

// Duplicates are detected against the whole graph, not just the currently
// referenced nodes, so a lone chip whose title collides with another node
// elsewhere in the graph still shows its id for disambiguation.
const duplicateTitleCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const node of graphNodes) {
    counts.set(node.title, (counts.get(node.title) ?? 0) + 1)
  }
  return counts
})

function hasDuplicateTitle(node: LGraphNode) {
  return (duplicateTitleCounts.value.get(node.title) ?? 0) > 1
}

// Newly referenced nodes are appended last, so keep the newest chip in view
// as the list grows past the row cap below - it should reveal by scrolling
// older rows up and out of view, not by pushing the rest of the composer down.
const scrollEl = useTemplateRef<HTMLDivElement>('scrollEl')

function scrollToNewestChip() {
  const el = scrollEl.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

useMutationObserver(scrollEl, () => requestAnimationFrame(scrollToNewestChip), {
  childList: true
})

// The scroll-fade mask defaults to a faded bottom edge even when nothing is
// scrollable, so it's only applied once the chips actually overflow the row
// cap below.
const hasOverflow = ref(false)

watch(
  () => nodes.length,
  () => {
    const el = scrollEl.value
    hasOverflow.value = !!el && el.scrollHeight > el.clientHeight
  },
  { immediate: true, flush: 'post' }
)
</script>

<template>
  <!-- max-h-28 caps the list at ~3 rows of xs chips; more than that scrolls -->
  <div
    v-if="nodes.length"
    ref="scrollEl"
    :class="
      cn(
        'flex scrollbar-custom max-h-28 flex-wrap gap-1.5 overflow-y-auto px-4 pt-3',
        hasOverflow && 'scroll-fade'
      )
    "
  >
    <AgentNodeChip
      v-for="node in nodes"
      :key="node.id"
      :node="node"
      :show-id="hasDuplicateTitle(node)"
    >
      <AttachmentActions>
        <AttachmentAction
          :aria-label="$t('g.remove')"
          @click.stop="emit('remove', node)"
        >
          <i class="icon-[lucide--x]" />
        </AttachmentAction>
      </AttachmentActions>
    </AgentNodeChip>
  </div>
</template>
