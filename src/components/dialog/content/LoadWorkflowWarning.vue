<!-- Warnings generated when loading the workflow -->
<template>
  <div class="comfy-missing-nodes">
    <span
      >When loading the graph, the following node types were not found:</span
    >
    <ul>
      <li v-for="(node, index) in uniqueNodes" :key="index">
        <template v-if="typeof node === 'object'">
          <span>{{ node.type }}</span>
          <span v-if="node.hint">{{ node.hint }}</span>
          <button v-if="node.action" @click="node.action.callback">
            {{ node.action.text }}
          </button>
        </template>
        <template v-else>
          <span>{{ node }}</span>
        </template>
      </li>
    </ul>
    <span v-if="hasAddedNodes">
      Nodes that have failed to load will show as red on the graph.
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface NodeType {
  type: string
  hint?: string
  action?: {
    text: string
    callback: () => void
  }
}

const props = defineProps<{
  missingNodeTypes: (string | NodeType)[]
  hasAddedNodes: boolean
}>()

const uniqueNodes = computed(() => {
  const seenTypes = new Set()
  return props.missingNodeTypes.filter((node) => {
    const type = typeof node === 'object' ? node.type : node
    if (seenTypes.has(type)) return false
    seenTypes.add(type)
    return true
  })
})
</script>
