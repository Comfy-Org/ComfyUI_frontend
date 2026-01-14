<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import FormSelectButton from '@/renderer/extensions/vueNodes/widgets/components/form/FormSelectButton.vue'

import LayoutField from './LayoutField.vue'

const { nodes } = defineProps<{ nodes: LGraphNode[] }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const { t } = useI18n()

const nodeState = computed({
  get() {
    if (nodes.length === 0) return null

    const nodeIds = nodes.map((node) => node.id.toString())
    const modes = nodeIds
      .map((nodeId) => {
        const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
        return nodeRef.value?.mode
      })
      .filter((mode): mode is number => mode !== undefined && mode !== null)

    if (modes.length === 0) return null

    // For multiple nodes, if all nodes have the same mode, return that mode, otherwise return null
    const firstMode = modes[0]
    const allSame = modes.every((mode) => mode === firstMode)

    return allSame ? firstMode : null
  },
  set(value: LGraphNode['mode']) {
    if (value === null || value === undefined) return

    const nodeIds = nodes.map((node) => node.id.toString())
    layoutStore.setNodesMode(nodeIds, value)
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
