import { computed, ref } from 'vue'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const currentHelpNode = ref<ComfyNodeDefImpl | null>(null)
const isHelpOpen = computed(() => currentHelpNode.value !== null)

function openHelp(nodeDef: ComfyNodeDefImpl) {
  currentHelpNode.value = nodeDef
}

function closeHelp() {
  currentHelpNode.value = null
}

export function useNodeHelp() {
  return {
    currentHelpNode,
    isHelpOpen,
    openHelp,
    closeHelp
  }
}
