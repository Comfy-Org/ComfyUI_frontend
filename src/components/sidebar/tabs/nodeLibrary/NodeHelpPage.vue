<template>
  <div class="flex h-full flex-col overflow-auto">
    <div
      class="flex items-center border-b border-(--p-divider-color) px-3 py-2"
    >
      <Button
        v-tooltip.bottom="$t('g.back')"
        icon="pi pi-arrow-left"
        text
        severity="secondary"
        @click="$emit('close')"
      />
      <span class="ml-2 font-semibold">{{ node.display_name }}</span>
    </div>
    <div class="grow p-4">
      <NodeHelpContent :node="node" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import Button from 'primevue/button'
import { computed } from 'vue'

import NodeHelpContent from '@/components/node/NodeHelpContent.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

const { node } = defineProps<{ node: ComfyNodeDefImpl }>()

defineEmits<{
  (e: 'close'): void
}>()

const nodeHelpStore = useNodeHelpStore()
const { nodeDef } = useSelectionState()

const activeHelpDef = computed(() =>
  nodeHelpStore.isHelpOpen ? nodeDef.value : null
)

// Keep the open help page synced with the current selection while help is open.
whenever(activeHelpDef, (def) => {
  const currentHelpNode = nodeHelpStore.currentHelpNode
  if (currentHelpNode?.nodePath === def.nodePath) return
  nodeHelpStore.openHelp(def)
})
</script>
