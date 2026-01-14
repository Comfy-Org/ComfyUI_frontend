<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useNodeMode } from '@/composables/canvas/useNodeMode'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import FormSelectButton from '@/renderer/extensions/vueNodes/widgets/components/form/FormSelectButton.vue'

import LayoutField from './LayoutField.vue'

const { nodes } = defineProps<{ nodes: LGraphNode[] }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const { t } = useI18n()
const { setNodesMode } = useNodeMode()

const nodeState = computed({
  get() {
    let mode: LGraphNode['mode'] | null = null

    if (nodes.length === 0) return null

    // For multiple nodes, if all nodes have the same mode, return that mode, otherwise return null
    if (nodes.length > 1) {
      mode = nodes[0].mode
      if (!nodes.every((node) => node.mode === mode)) {
        mode = null
      }
    } else {
      mode = nodes[0].mode
    }

    return mode
  },
  set(value: LGraphNode['mode']) {
    setNodesMode(nodes, value)
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
