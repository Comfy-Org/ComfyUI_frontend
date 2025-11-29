<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import CanvasTabBar from '@/components/canvas/CanvasTabBar.vue'
import CanvasLeftSidebar from '@/components/canvas/CanvasLeftSidebar.vue'
import CanvasBottomBar from '@/components/canvas/CanvasBottomBar.vue'
import { FlowNode } from '@/components/nodes'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useUiStore } from '@/stores/uiStore'

import {
  LOAD_CHECKPOINT,
  CLIP_TEXT_ENCODE,
  KSAMPLER,
  EMPTY_LATENT_IMAGE,
  VAE_DECODE,
  SAVE_IMAGE,
} from '@/data/nodeDefinitions'

import type { CanvasRouteParams } from '@/types/canvas'
import type { FlowNodeData, NodeState } from '@/types/node'
import type { Node, Edge } from '@vue-flow/core'

const props = defineProps<CanvasRouteParams>()

const workspaceStore = useWorkspaceStore()
const uiStore = useUiStore()

const isInterface2 = computed(() => uiStore.interface2Enabled)

// Custom node types for Vue Flow
const nodeTypes = {
  flowNode: markRaw(FlowNode),
}

// Helper to create FlowNodeData
function createNodeData(
  definition: typeof LOAD_CHECKPOINT,
  overrides: Partial<FlowNodeData> = {}
): FlowNodeData {
  return {
    definition,
    widgetValues: Object.fromEntries(
      definition.widgets.map((w) => [w.name, w.value])
    ),
    state: 'idle' as NodeState,
    flags: {},
    ...overrides,
  }
}

// Keyboard shortcut: X to toggle interface
function handleKeydown(event: KeyboardEvent): void {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return
  }

  if (event.key.toLowerCase() === 'x') {
    uiStore.toggleInterface2()
  }
}

onMounted(() => {
  workspaceStore.setCurrentIds(props.workspaceId, props.projectId, props.canvasId)
  workspaceStore.openCanvas(props.canvasId, props.canvasId, props.projectId)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Vue Flow
const { onNodeClick, onPaneClick } = useVueFlow()

// Sample workflow nodes
const nodes = ref<Node<FlowNodeData>[]>([
  {
    id: 'load-checkpoint',
    type: 'flowNode',
    position: { x: 50, y: 150 },
    data: createNodeData(LOAD_CHECKPOINT),
  },
  {
    id: 'empty-latent',
    type: 'flowNode',
    position: { x: 50, y: 400 },
    data: createNodeData(EMPTY_LATENT_IMAGE),
  },
  {
    id: 'clip-text-pos',
    type: 'flowNode',
    position: { x: 350, y: 50 },
    data: createNodeData(CLIP_TEXT_ENCODE, {
      title: 'Positive Prompt',
      widgetValues: { text: 'beautiful mountain landscape, sunset, dramatic lighting, 8k, detailed' },
    }),
  },
  {
    id: 'clip-text-neg',
    type: 'flowNode',
    position: { x: 350, y: 280 },
    data: createNodeData(CLIP_TEXT_ENCODE, {
      title: 'Negative Prompt',
      widgetValues: { text: 'blurry, low quality, watermark, text' },
    }),
  },
  {
    id: 'ksampler',
    type: 'flowNode',
    position: { x: 700, y: 150 },
    data: createNodeData(KSAMPLER, {
      state: 'executing',
      progress: 0.65,
    }),
  },
  {
    id: 'vae-decode',
    type: 'flowNode',
    position: { x: 1050, y: 200 },
    data: createNodeData(VAE_DECODE),
  },
  {
    id: 'save-image',
    type: 'flowNode',
    position: { x: 1300, y: 200 },
    data: createNodeData(SAVE_IMAGE),
  },
])

// Edges with proper slot connections
const edges = ref<Edge[]>([
  // LoadCheckpoint -> CLIP Text Encode (Positive)
  {
    id: 'e1',
    source: 'load-checkpoint',
    sourceHandle: 'output-1', // CLIP output
    target: 'clip-text-pos',
    targetHandle: 'input-0', // clip input
    style: { stroke: '#ffcc80', strokeWidth: 2 },
  },
  // LoadCheckpoint -> CLIP Text Encode (Negative)
  {
    id: 'e2',
    source: 'load-checkpoint',
    sourceHandle: 'output-1', // CLIP output
    target: 'clip-text-neg',
    targetHandle: 'input-0', // clip input
    style: { stroke: '#ffcc80', strokeWidth: 2 },
  },
  // LoadCheckpoint -> KSampler (model)
  {
    id: 'e3',
    source: 'load-checkpoint',
    sourceHandle: 'output-0', // MODEL output
    target: 'ksampler',
    targetHandle: 'input-0', // model input
    style: { stroke: '#b39ddb', strokeWidth: 2 },
  },
  // CLIP Positive -> KSampler (positive)
  {
    id: 'e4',
    source: 'clip-text-pos',
    sourceHandle: 'output-0', // CONDITIONING output
    target: 'ksampler',
    targetHandle: 'input-1', // positive input
    style: { stroke: '#ffab40', strokeWidth: 2 },
  },
  // CLIP Negative -> KSampler (negative)
  {
    id: 'e5',
    source: 'clip-text-neg',
    sourceHandle: 'output-0', // CONDITIONING output
    target: 'ksampler',
    targetHandle: 'input-2', // negative input
    style: { stroke: '#ffab40', strokeWidth: 2 },
  },
  // Empty Latent -> KSampler (latent_image)
  {
    id: 'e6',
    source: 'empty-latent',
    sourceHandle: 'output-0', // LATENT output
    target: 'ksampler',
    targetHandle: 'input-3', // latent_image input
    style: { stroke: '#ff80ab', strokeWidth: 2 },
  },
  // KSampler -> VAE Decode (samples)
  {
    id: 'e7',
    source: 'ksampler',
    sourceHandle: 'output-0', // LATENT output
    target: 'vae-decode',
    targetHandle: 'input-0', // samples input
    style: { stroke: '#ff80ab', strokeWidth: 2 },
  },
  // LoadCheckpoint -> VAE Decode (vae)
  {
    id: 'e8',
    source: 'load-checkpoint',
    sourceHandle: 'output-2', // VAE output
    target: 'vae-decode',
    targetHandle: 'input-1', // vae input
    style: { stroke: '#ef5350', strokeWidth: 2 },
  },
  // VAE Decode -> Save Image
  {
    id: 'e9',
    source: 'vae-decode',
    sourceHandle: 'output-0', // IMAGE output
    target: 'save-image',
    targetHandle: 'input-0', // images input
    style: { stroke: '#64b5f6', strokeWidth: 2 },
  },
])

const selectedNode = ref<Node<FlowNodeData> | null>(null)

onNodeClick(({ node }) => {
  selectedNode.value = node as Node<FlowNodeData>
})

onPaneClick(() => {
  selectedNode.value = null
})

// State toggle functions for demo
function toggleNodeState(state: NodeState): void {
  if (!selectedNode.value) return
  const node = nodes.value.find((n) => n.id === selectedNode.value?.id)
  if (node) {
    node.data.state = node.data.state === state ? 'idle' : state
  }
}

function toggleCollapsed(): void {
  if (!selectedNode.value) return
  const node = nodes.value.find((n) => n.id === selectedNode.value?.id)
  if (node) {
    node.data.flags.collapsed = !node.data.flags.collapsed
  }
}
</script>

<template>
  <div class="flex h-screen flex-col bg-white dark:bg-zinc-950">
    <!-- Tab Bar -->
    <CanvasTabBar />

    <!-- Main content area -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left sidebar -->
      <CanvasLeftSidebar />

      <!-- Canvas area -->
      <main class="relative flex-1 bg-zinc-100 dark:bg-zinc-900">
        <!-- Vue Flow Canvas -->
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="nodeTypes"
          :default-viewport="{ x: 50, y: 50, zoom: 0.85 }"
          :min-zoom="0.1"
          :max-zoom="4"
          fit-view-on-init
          class="vue-flow-canvas"
        >
          <Background pattern-color="#27272a" :gap="20" :size="1" />
        </VueFlow>

        <!-- Interface 2.0: Floating bottom bar -->
        <CanvasBottomBar v-if="isInterface2" />

        <!-- Workflow name -->
        <div class="absolute left-4 top-4 z-10">
          <span
            class="rounded bg-white/80 px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur dark:bg-zinc-800/80 dark:text-zinc-300"
          >
            {{ props.canvasId }}
          </span>
        </div>

        <!-- Legend (bottom left) -->
        <div class="absolute bottom-20 left-4 z-10 flex flex-col gap-1 rounded-lg bg-zinc-900/90 p-3 text-xs backdrop-blur">
          <div class="font-medium text-zinc-300 mb-1">Slot Types</div>
          <div class="flex items-center gap-2">
            <div class="h-2.5 w-2.5 rounded-full" style="background: #b39ddb" />
            <span class="text-zinc-400">MODEL</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-2.5 w-2.5 rounded-full" style="background: #ffcc80" />
            <span class="text-zinc-400">CLIP</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-2.5 w-2.5 rounded-full" style="background: #ef5350" />
            <span class="text-zinc-400">VAE</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-2.5 w-2.5 rounded-full" style="background: #ff80ab" />
            <span class="text-zinc-400">LATENT</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-2.5 w-2.5 rounded-full" style="background: #ffab40" />
            <span class="text-zinc-400">CONDITIONING</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-2.5 w-2.5 rounded-full" style="background: #64b5f6" />
            <span class="text-zinc-400">IMAGE</span>
          </div>
        </div>
      </main>

      <!-- Right sidebar - Node Properties -->
      <aside
        v-if="selectedNode"
        class="flex w-80 flex-col border-l border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Properties</h2>
          <button
            class="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            @click="selectedNode = null"
          >
            <i class="pi pi-times text-xs" />
          </button>
        </div>

        <!-- Node Info -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="space-y-4">
            <div>
              <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Node Type</label>
              <p class="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                {{ selectedNode.data.definition.displayName }}
              </p>
            </div>
            <div>
              <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Node ID</label>
              <p class="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">{{ selectedNode.id }}</p>
            </div>
            <div>
              <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400">State</label>
              <p class="mt-1 text-sm capitalize" :class="{
                'text-zinc-400': selectedNode.data.state === 'idle',
                'text-blue-400': selectedNode.data.state === 'executing',
                'text-green-400': selectedNode.data.state === 'completed',
                'text-red-400': selectedNode.data.state === 'error',
                'text-amber-400': selectedNode.data.state === 'bypassed',
                'text-zinc-500': selectedNode.data.state === 'muted',
              }">
                {{ selectedNode.data.state }}
              </p>
            </div>
            <div>
              <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Position</label>
              <p class="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                x: {{ Math.round(selectedNode.position.x) }}, y: {{ Math.round(selectedNode.position.y) }}
              </p>
            </div>

            <!-- State toggles for demo -->
            <div class="border-t border-zinc-700 pt-4">
              <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 block">Toggle State (Demo)</label>
              <div class="flex flex-wrap gap-2">
                <button
                  class="rounded px-2 py-1 text-xs bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                  @click="toggleCollapsed"
                >
                  {{ selectedNode.data.flags.collapsed ? 'Expand' : 'Collapse' }}
                </button>
                <button
                  class="rounded px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-500"
                  @click="toggleNodeState('executing')"
                >
                  Executing
                </button>
                <button
                  class="rounded px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-500"
                  @click="toggleNodeState('error')"
                >
                  Error
                </button>
                <button
                  class="rounded px-2 py-1 text-xs bg-amber-600 text-white hover:bg-amber-500"
                  @click="toggleNodeState('bypassed')"
                >
                  Bypass
                </button>
                <button
                  class="rounded px-2 py-1 text-xs bg-zinc-600 text-white hover:bg-zinc-500"
                  @click="toggleNodeState('muted')"
                >
                  Mute
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style>
.vue-flow-canvas {
  width: 100%;
  height: 100%;
  background-color: #18181b;
}

/* Override default node styles - our FlowNode component handles its own styling */
.vue-flow .vue-flow__node-flowNode {
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}

.vue-flow .vue-flow__node-flowNode.selected {
  box-shadow: none;
}

/* Edge styling */
.vue-flow .vue-flow__edge-path {
  stroke-width: 2;
}

.vue-flow .vue-flow__edge.selected .vue-flow__edge-path {
  stroke-width: 3;
}

/* Handle styling - handles are invisible, SlotDots are the visual indicators */
.vue-flow .vue-flow__handle {
  opacity: 0 !important;
  width: 16px;
  height: 16px;
  background: transparent !important;
  border: none !important;
}

/* Connection line styling */
.vue-flow .vue-flow__connection-line {
  stroke: #3b82f6;
  stroke-width: 2;
}
</style>
