<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WorkflowGraph } from '../../config/workflow-execution'

const { graph } = defineProps<{ graph: WorkflowGraph }>()
const expanded = ref(false)
const layout = computed(() => {
  const levels = new Map<string, number>()
  const edges: { from: string; to: string }[] = []
  for (const [id, node] of Object.entries(graph))
    for (const value of Object.values(node.inputs))
      if (
        Array.isArray(value) &&
        typeof value[0] === 'string' &&
        graph[value[0]]
      )
        edges.push({ from: value[0], to: id })
  for (let pass = 0; pass < Object.keys(graph).length; pass++) {
    let changed = false
    for (const id of Object.keys(graph)) {
      if (levels.has(id)) continue
      const parents = edges
        .filter((edge) => edge.to === id)
        .map((edge) => edge.from)
      if (parents.every((parent) => levels.has(parent))) {
        levels.set(
          id,
          Math.max(-1, ...parents.map((parent) => levels.get(parent) ?? 0)) + 1
        )
        changed = true
      }
    }
    if (!changed) break
  }
  const rows = new Map<number, number>()
  const nodes = Object.entries(graph).map(([id, node]) => {
    const column = levels.get(id) ?? 0
    const row = rows.get(column) ?? 0
    rows.set(column, row + 1)
    return {
      id,
      label: node._meta?.title ?? node.class_type,
      type: node.class_type,
      x: column * 220 + 20,
      y: row * 86 + 20
    }
  })
  return {
    nodes,
    edges,
    width: Math.max(...nodes.map((node) => node.x)) + 210,
    height: Math.max(...nodes.map((node) => node.y)) + 86
  }
})
const points = computed(
  () => new Map(layout.value.nodes.map((node) => [node.id, node]))
)
function connection(from: string, to: string) {
  const a = points.value.get(from)
  const b = points.value.get(to)
  if (!a || !b) return ''
  return `M ${a.x + 180} ${a.y + 28} C ${a.x + 205} ${a.y + 28}, ${b.x - 25} ${b.y + 28}, ${b.x} ${b.y + 28}`
}
</script>

<template>
  <section class="rounded-2xl border border-transparency-white-t20 p-5">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <h2 class="text-lg text-primary-comfy-canvas">Inside the workflow</h2>
        <p class="mt-1 text-sm text-primary-warm-gray">
          {{ layout.nodes.length }} nodes · Read-only overview of the execution
          graph
        </p>
      </div>
      <button
        class="min-h-11 rounded-lg border border-transparency-white-t20 px-4 text-sm text-primary-comfy-canvas hover:bg-transparency-white-t8"
        :aria-pressed="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Fit graph' : 'Zoom in' }}
      </button>
    </div>
    <div
      class="overflow-auto rounded-xl bg-transparency-white-t8"
      tabindex="0"
      aria-label="Workflow graph; scroll to explore nodes"
    >
      <svg
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        :style="{
          width: expanded ? `${layout.width}px` : '100%',
          minWidth: '760px'
        }"
        role="img"
        aria-label="Connected nodes in the workflow"
      >
        <path
          v-for="(edge, index) in layout.edges"
          :key="index"
          :d="connection(edge.from, edge.to)"
          fill="none"
          stroke="currentColor"
          class="text-primary-comfy-yellow/30"
          stroke-width="2"
        />
        <g
          v-for="node in layout.nodes"
          :key="node.id"
          :transform="`translate(${node.x}, ${node.y})`"
        >
          <title>{{ node.label }} ({{ node.type }})</title>
          <rect
            width="180"
            height="58"
            rx="9"
            class="fill-primary-comfy-ink stroke-transparency-white-t20"
          />
          <circle cx="0" cy="28" r="4" class="fill-primary-comfy-yellow" />
          <circle cx="180" cy="28" r="4" class="fill-primary-comfy-yellow" />
          <text x="12" y="25" class="fill-primary-comfy-canvas" font-size="12">
            {{ node.label.slice(0, 23) }}
          </text>
          <text x="12" y="44" class="fill-primary-warm-gray" font-size="10">
            {{ node.id }}
          </text>
        </g>
      </svg>
    </div>
  </section>
</template>
