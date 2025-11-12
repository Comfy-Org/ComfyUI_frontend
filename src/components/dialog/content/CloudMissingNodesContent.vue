<template>
  <div class="flex w-[490px] flex-col">
    <ContentDivider :width="1" />
    <div class="flex h-full w-full flex-col gap-4 p-4">
      <!-- Description -->
      <div>
        <p class="m-0 text-sm leading-4 text-muted-foreground">
          {{ $t('cloud.missingNodes.description') }}
          <br /><br />
          {{ $t('cloud.missingNodes.priorityMessage') }}
        </p>
      </div>

      <!-- Missing Nodes List Wrapper -->
      <div
        class="flex flex-col max-h-[256px] rounded-lg py-2 scrollbar-custom bg-component-node-widget-background"
      >
        <div
          v-for="(node, i) in uniqueNodes"
          :key="i"
          class="flex min-h-8 items-center justify-between px-4 py-2 bg-component-node-widget-background text-text-secondary"
        >
          <span class="text-xs">
            {{ node.label }}
          </span>
        </div>
      </div>

      <!-- Bottom instruction -->
      <div>
        <p class="m-0 text-sm leading-4 text-muted-foreground">
          {{ $t('cloud.missingNodes.replacementInstruction') }}
        </p>
      </div>
    </div>
    <ContentDivider :width="1" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ContentDivider from '@/components/common/ContentDivider.vue'
import type { MissingNodeType } from '@/types/comfy'

const props = defineProps<{
  missingNodeTypes: MissingNodeType[]
}>()

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
