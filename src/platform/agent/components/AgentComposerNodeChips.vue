<script setup lang="ts">
import { computed } from 'vue'

import Attachment from '@/components/ui/attachment/Attachment.vue'
import AttachmentAction from '@/components/ui/attachment/AttachmentAction.vue'
import AttachmentActions from '@/components/ui/attachment/AttachmentActions.vue'
import AttachmentContent from '@/components/ui/attachment/AttachmentContent.vue'
import AttachmentMedia from '@/components/ui/attachment/AttachmentMedia.vue'
import AttachmentTitle from '@/components/ui/attachment/AttachmentTitle.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

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
</script>

<template>
  <div v-if="nodes.length" class="flex flex-wrap gap-1.5 px-4 pt-3">
    <Attachment v-for="node in nodes" :key="node.id" size="xs">
      <AttachmentMedia>
        <i class="icon-[comfy--node] size-3.5" />
      </AttachmentMedia>
      <AttachmentContent class="flex items-center gap-1">
        <AttachmentTitle>{{ node.title }}</AttachmentTitle>
        <span
          v-if="hasDuplicateTitle(node)"
          class="shrink-0 font-mono text-muted-foreground"
        >
          #{{ node.id }}
        </span>
      </AttachmentContent>
      <AttachmentActions>
        <Tooltip :delay-duration="500">
          <TooltipTrigger>
            <AttachmentAction
              :aria-label="$t('g.remove')"
              @click="emit('remove', node)"
            >
              <i class="icon-[lucide--x]" />
            </AttachmentAction>
          </TooltipTrigger>
          <TooltipContent side="top">{{ $t('g.remove') }}</TooltipContent>
        </Tooltip>
      </AttachmentActions>
    </Attachment>
  </div>
</template>
