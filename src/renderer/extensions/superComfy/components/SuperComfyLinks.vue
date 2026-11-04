<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import {
  linkPath,
  portAnchor,
  portIndex
} from '@/renderer/extensions/superComfy/canvas/canvasGeometry'
import type { DraftLink } from '@/renderer/extensions/superComfy/canvas/useCanvasGestures'
import type {
  NodeId,
  SuperEdge,
  SuperGraphDocument
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { findNode } from '@/renderer/extensions/superComfy/engine/graphTopology'

const { doc, draft, selection } = defineProps<{
  doc: SuperGraphDocument
  draft: DraftLink | null
  selection: ReadonlySet<NodeId>
}>()

function edgePath(edge: SuperEdge): string | null {
  const source = findNode(doc, edge.from.node)
  const target = findNode(doc, edge.to.node)
  if (!source || !target) return null
  const from = portIndex(source, 'out', edge.from.port)
  const to = portIndex(target, 'in', edge.to.port)
  if (from < 0 || to < 0) return null
  return linkPath(portAnchor(source, 'out', from), portAnchor(target, 'in', to))
}

const links = computed(() =>
  doc.edges.flatMap((edge) => {
    const path = edgePath(edge)
    if (path === null) return []
    return [
      {
        id: edge.id,
        path,
        active: selection.has(edge.from.node) || selection.has(edge.to.node)
      }
    ]
  })
)

const draftPath = computed(() =>
  draft ? linkPath(draft.start, draft.end) : null
)
</script>

<template>
  <svg
    class="pointer-events-none absolute top-0 left-0 size-px overflow-visible"
    aria-hidden="true"
  >
    <path
      v-for="link in links"
      :key="link.id"
      :d="link.path"
      vector-effect="non-scaling-stroke"
      :class="
        cn(
          'fill-none stroke-[1.5]',
          link.active ? 'stroke-foreground/70' : 'stroke-muted-foreground/40'
        )
      "
    />
    <path
      v-if="draftPath"
      :d="draftPath"
      vector-effect="non-scaling-stroke"
      class="fill-none stroke-foreground/70 stroke-[1.5] [stroke-dasharray:4_4]"
    />
  </svg>
</template>
