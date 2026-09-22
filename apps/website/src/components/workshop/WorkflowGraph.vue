<script setup lang="ts">
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { Maximize, Minus, Plus } from '@lucide/vue'
import { nodeValues, workflowViewerSchema } from '../../config/workflow-viewer'
import type { ViewerWorkflow } from '../../config/workflow-viewer'
import type { createWorkflowCanvas } from './workflow-canvas'

const { template } = defineProps<{ template: string }>()
const canvasElement = useTemplateRef('canvas')
const workflow = shallowRef<ViewerWorkflow>()
const selected = ref('')
const error = ref(false)
const ready = ref(false)
const current = computed(() =>
  selected.value
    ? workflow.value?.definitions?.subgraphs.find(
        (graph) => graph.id === selected.value
      )
    : workflow.value
)
let renderer: ReturnType<typeof createWorkflowCanvas> | undefined
let observer: ResizeObserver | undefined
const controller = new AbortController()

onMounted(async () => {
  try {
    const [response, { createWorkflowCanvas }] = await Promise.all([
      fetch(`/workflows/graphs/${template}.json`, {
        signal: controller.signal
      }),
      import('./workflow-canvas')
    ])
    if (!response.ok) throw new Error('Workflow unavailable')
    const data = workflowViewerSchema.parse(await response.json())
    if (controller.signal.aborted || !canvasElement.value) return
    workflow.value = data
    renderer = createWorkflowCanvas(canvasElement.value, data)
    renderer.show(data)
    observer = new ResizeObserver(() => renderer?.fit())
    observer.observe(canvasElement.value)
    ready.value = true
  } catch {
    if (!controller.signal.aborted) error.value = true
  }
})
watch(current, (graph) => {
  if (graph) renderer?.show(graph)
})
onScopeDispose(() => {
  controller.abort()
  observer?.disconnect()
  renderer?.dispose()
})
function keydown(event: KeyboardEvent) {
  const movements: Record<string, [number, number]> = {
    ArrowLeft: [80, 0],
    ArrowRight: [-80, 0],
    ArrowUp: [0, 80],
    ArrowDown: [0, -80]
  }
  const movement = movements[event.key]
  if (movement) renderer?.pan(...movement)
  else if (event.key === '+' || event.key === '=') renderer?.zoom(1.25)
  else if (event.key === '-') renderer?.zoom(0.8)
  else if (event.key === '0') renderer?.fit()
  else return
  event.preventDefault()
}
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-transparency-white-t20"
    aria-label="Inside the workflow"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-4 border-b border-transparency-white-t20 p-5"
    >
      <div>
        <h2 class="text-lg text-primary-comfy-canvas">Inside the workflow</h2>
        <p class="mt-1 text-sm text-primary-warm-gray">
          {{ current ? `${current.nodes.length} nodes · ` : '' }}Read-only
          ComfyUI canvas
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label
          v-if="workflow?.definitions?.subgraphs.length"
          class="text-sm text-primary-warm-gray"
        >
          <span class="sr-only">Graph level</span>
          <select
            v-model="selected"
            class="h-11 max-w-64 rounded-lg border border-transparency-white-t20 bg-page px-3 text-primary-comfy-canvas"
          >
            <option value="">Workflow overview</option>
            <option
              v-for="subgraph in workflow.definitions.subgraphs"
              :key="subgraph.id"
              :value="subgraph.id"
            >
              {{ subgraph.name ?? 'Nested graph' }}
            </option>
          </select>
        </label>
        <div
          class="flex items-center rounded-lg border border-transparency-white-t20"
        >
          <button
            type="button"
            :disabled="!ready"
            aria-label="Zoom out"
            class="flex size-11 items-center justify-center text-primary-warm-white hover:bg-transparency-white-t8 disabled:opacity-40"
            @click="renderer?.zoom(0.8)"
          >
            <Minus class="size-4" />
          </button>
          <button
            type="button"
            :disabled="!ready"
            aria-label="Zoom in"
            class="flex size-11 items-center justify-center text-primary-warm-white hover:bg-transparency-white-t8 disabled:opacity-40"
            @click="renderer?.zoom(1.25)"
          >
            <Plus class="size-4" />
          </button>
          <button
            type="button"
            :disabled="!ready"
            aria-label="Fit graph"
            class="flex size-11 items-center justify-center text-primary-warm-white hover:bg-transparency-white-t8 disabled:opacity-40"
            @click="renderer?.fit()"
          >
            <Maximize class="size-4" />
          </button>
        </div>
      </div>
    </div>
    <div class="relative">
      <canvas
        ref="canvas"
        class="block h-[560px] w-full touch-none outline-primary-comfy-yellow lg:h-[640px]"
        tabindex="0"
        role="img"
        aria-label="ComfyUI workflow graph. Drag to pan, scroll to zoom. Keyboard: arrow keys to pan, plus and minus to zoom, zero to fit."
        @keydown="keydown"
        @contextmenu.prevent
      />
      <p
        v-if="!ready"
        role="status"
        class="absolute inset-0 flex items-center justify-center bg-page p-8 text-center text-sm text-primary-warm-gray"
      >
        {{
          error
            ? 'The graph could not load. Download the workflow JSON to view it in ComfyUI.'
            : 'Loading workflow graph…'
        }}
      </p>
    </div>
    <div
      class="border-t border-transparency-white-t20 px-5 py-4 text-xs text-primary-warm-gray"
    >
      Drag to pan · Scroll to zoom · Original template layout. Node previews and
      custom controls are available in ComfyUI.
    </div>
    <details
      v-if="current"
      class="border-t border-transparency-white-t20 p-5 text-sm text-primary-warm-gray"
    >
      <summary class="cursor-pointer text-primary-warm-white">
        Node details ({{ current.nodes.length }})
      </summary>
      <ul class="mt-4 grid gap-4 md:grid-cols-2">
        <li
          v-for="node in current.nodes"
          :key="node.id"
          class="min-w-0 rounded-xl bg-transparency-white-t8 p-4"
        >
          <p class="font-medium wrap-break-word text-primary-warm-white">
            {{
              node.title ??
              workflow?.definitions?.subgraphs.find(
                (graph) => graph.id === node.type
              )?.name ??
              node.type
            }}
          </p>
          <p class="mt-1 text-xs break-all">#{{ node.id }} · {{ node.type }}</p>
          <p
            v-for="(value, index) in nodeValues(node)"
            :key="index"
            class="mt-2 text-xs/relaxed wrap-break-word whitespace-pre-wrap"
          >
            {{ value }}
          </p>
        </li>
      </ul>
    </details>
  </section>
</template>
