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
      <MissingCoreNodesMessage v-if="!isCloud" :missing-core-nodes />

      <!-- Missing Nodes List Wrapper -->
      <div
        class="comfy-missing-nodes flex flex-col max-h-[256px] rounded-lg py-2 scrollbar-custom bg-secondary-background"
      >
        <div
          v-for="(node, i) in uniqueNodes"
          :key="i"
          class="flex min-h-8 items-center justify-between px-4 py-2 bg-secondary-background text-muted-foreground"
        >
          <div class="flex items-center gap-2">
            <StatusBadge
              v-if="node.isReplaceable"
              :label="$t('nodeReplacement.replaceable')"
              severity="default"
            />
            <span class="text-xs">{{ node.label }}</span>
            <span v-if="node.hint" class="text-xs text-muted-foreground">
              {{ node.hint }}
            </span>
          </div>
          <Button
            v-if="node.isReplaceable"
            variant="secondary"
            size="sm"
            @click="emit('replace', node.label)"
          >
            {{ $t('nodeReplacement.replace') }}
          </Button>
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

import StatusBadge from '@/components/common/StatusBadge.vue'
import MissingCoreNodesMessage from '@/components/dialog/content/MissingCoreNodesMessage.vue'
import Button from '@/components/ui/button/Button.vue'
import { isCloud } from '@/platform/distribution/types'
import type { MissingNodeType } from '@/types/comfy'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'

const props = defineProps<{
  missingNodeTypes: MissingNodeType[]
}>()

const emit = defineEmits<{
  (e: 'replace', nodeType: string): void
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
          action: node.action,
          isReplaceable: node.isReplaceable ?? false,
          replacement: node.replacement
        }
      }
      return { label: node, isReplaceable: false }
    })
})
</script>
