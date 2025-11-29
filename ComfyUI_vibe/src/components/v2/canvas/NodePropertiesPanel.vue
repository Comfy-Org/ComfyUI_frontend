<script setup lang="ts">
import type { Node } from '@vue-flow/core'
import type { FlowNodeData, NodeState } from '@/types/node'

const props = defineProps<{
  node: Node<FlowNodeData>
}>()

const emit = defineEmits<{
  close: []
  toggleState: [state: NodeState]
  toggleCollapsed: []
}>()
</script>

<template>
  <aside class="flex w-80 flex-col border-l border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Properties</h2>
      <button
        class="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        @click="emit('close')"
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
            {{ props.node.data.definition.displayName }}
          </p>
        </div>
        <div>
          <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Node ID</label>
          <p class="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">{{ props.node.id }}</p>
        </div>
        <div>
          <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400">State</label>
          <p
            class="mt-1 text-sm capitalize"
            :class="{
              'text-zinc-400': props.node.data.state === 'idle',
              'text-blue-400': props.node.data.state === 'executing',
              'text-green-400': props.node.data.state === 'completed',
              'text-red-400': props.node.data.state === 'error',
              'text-amber-400': props.node.data.state === 'bypassed',
              'text-zinc-500': props.node.data.state === 'muted',
            }"
          >
            {{ props.node.data.state }}
          </p>
        </div>
        <div>
          <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Position</label>
          <p class="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
            x: {{ Math.round(props.node.position.x) }}, y: {{ Math.round(props.node.position.y) }}
          </p>
        </div>

        <!-- State toggles for demo -->
        <div class="border-t border-zinc-700 pt-4">
          <label class="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Toggle State (Demo)</label>
          <div class="flex flex-wrap gap-2">
            <button
              class="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
              @click="emit('toggleCollapsed')"
            >
              {{ props.node.data.flags.collapsed ? 'Expand' : 'Collapse' }}
            </button>
            <button
              class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
              @click="emit('toggleState', 'executing')"
            >
              Executing
            </button>
            <button
              class="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
              @click="emit('toggleState', 'error')"
            >
              Error
            </button>
            <button
              class="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-500"
              @click="emit('toggleState', 'bypassed')"
            >
              Bypass
            </button>
            <button
              class="rounded bg-zinc-600 px-2 py-1 text-xs text-white hover:bg-zinc-500"
              @click="emit('toggleState', 'muted')"
            >
              Mute
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
