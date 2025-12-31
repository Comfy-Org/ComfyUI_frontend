<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

type PickedNode = Pick<LGraphNode, 'pinned' | 'pin'>

/**
 * Good design limits dependencies and simplifies the interface of the abstraction layer.
 * Here, we only care about the pinned and pin methods,
 * and do not concern ourselves with other methods.
 */
const { nodes } = defineProps<{ nodes: PickedNode[] }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const { t } = useI18n()

// Pinned state
const isPinned = computed<boolean>({
  get() {
    return nodes.some((node) => node.pinned)
  },
  set(value) {
    nodes.forEach((node) => node.pin(value))
    emit('changed')
  }
})
</script>

<template>
  <div class="flex items-center justify-between">
    <span>
      {{ t('rightSidePanel.pinned') }}
    </span>
    <ToggleSwitch v-model="isPinned" />
  </div>
</template>
