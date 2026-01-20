<template>
  <div
    class="flex w-[490px] flex-col border-t-1 border-border-default"
    :class="isCloud ? 'border-b-1' : ''"
  >
    <div class="flex h-full w-full flex-col gap-4 p-4">
      <!-- Description -->
      <div>
        <p class="m-0 text-sm leading-4 text-muted-foreground">
          {{
            isCloud
              ? $t('missingNodes.cloud.description')
              : $t('missingNodes.oss.description')
          }}
        </p>
      </div>
      <MissingCoreNodesMessage
        v-if="!isCloud"
        :missing-core-nodes
      />

      <!-- Missing Nodes List Wrapper -->
      <div
        class="comfy-missing-nodes flex scrollbar-custom max-h-[256px] flex-col rounded-lg bg-secondary-background py-2"
      >
        <div
          v-for="(node, i) in uniqueNodes"
          :key="i"
          class="flex min-h-8 items-center justify-between bg-secondary-background px-4 py-2 text-muted-foreground"
        >
          <span class="text-xs">
            {{ node.label }}
          </span>
          <span
            v-if="node.hint"
            class="text-xs"
          >{{ node.hint }}</span>
        </div>
      </div>

      <!-- Bottom instruction -->
      <div>
        <p class="m-0 text-sm leading-4 text-muted-foreground">
          {{
            isCloud
              ? $t('missingNodes.cloud.replacementInstruction')
              : $t('missingNodes.oss.replacementInstruction')
          }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import MissingCoreNodesMessage from '@/components/dialog/content/MissingCoreNodesMessage.vue'
import { isCloud } from '@/platform/distribution/types'
import type { MissingNodeType } from '@/types/comfy'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'

const props = defineProps<{
  missingNodeTypes: MissingNodeType[]
}>()

// Get missing core nodes for OSS mode
const { missingCoreNodes } = useMissingNodes()

const uniqueNodes = computed(() => {
  const seenTypes = new Set()
  return props.missingNodeTypes
    .filter((node) => {
      const type = typeof node === 'object' ? node.type : node
      if (seenTypes.has(type)) return false
      seenTypes.add(type)
      return true
    })
    .map((node) => {
      if (typeof node === 'object') {
        return {
          label: node.type,
          hint: node.hint,
          action: node.action
        }
      }
      return { label: node }
    })
})
</script>
