<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import FormSelectButton from '@/renderer/extensions/vueNodes/widgets/components/form/FormSelectButton.vue'

import LayoutField from './LayoutField.vue'

/**
 * Good design limits dependencies and simplifies the interface of the abstraction layer.
 * Here, we only care about the node id,
 * and do not concern ourselves with other methods.
 */
type PickedNode = Pick<LGraphNode, 'id'>

const { nodes } = defineProps<{ nodes: PickedNode[] }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const { t } = useI18n()

const nodeIds = computed(() => nodes.map((node) => node.id.toString()))

/**
 * Retrieves layout references for all selected nodes from the store.
 */
const nodeRefs = computed(() =>
  nodeIds.value.map((nodeId) => layoutStore.getNodeLayoutRef(nodeId))
)

/**
 * Manages the execution mode state for selected nodes.
 * When getting: returns the common mode if all nodes share the same mode, null otherwise.
 * When setting: applies the new mode to all selected nodes via the layout store.
 */
const nodeState = computed({
  get() {
    if (nodeIds.value.length === 0) return null

    const modes = nodeRefs.value
      .map((nodeRef) => nodeRef.value?.mode)
      .filter((mode): mode is number => mode !== undefined && mode !== null)

    if (modes.length === 0) return null

    const firstMode = modes[0]
    const allSame = modes.every((mode) => mode === firstMode)

    return allSame ? firstMode : null
  },
  set(value: LGraphNode['mode']) {
    if (value === null || value === undefined) return

    layoutStore.setNodesMode(nodeIds.value, value)
    emit('changed')
  }
})
</script>

<template>
  <LayoutField :label="t('rightSidePanel.nodeState')">
    <FormSelectButton
      v-model="nodeState"
      class="w-full"
      :options="[
        {
          label: t('rightSidePanel.normal'),
          value: LGraphEventMode.ALWAYS
        },
        {
          label: t('rightSidePanel.bypass'),
          value: LGraphEventMode.BYPASS
        },
        {
          label: t('rightSidePanel.mute'),
          value: LGraphEventMode.NEVER
        }
      ]"
    />
  </LayoutField>
</template>
