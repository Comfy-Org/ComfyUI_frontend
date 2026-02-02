<template>
  <TabsContent
    value="custom"
    class="min-h-0 flex-1 overflow-y-auto"
  >
    <div v-for="(section, index) in sections" :key="section.title ?? index">
      <!-- Section header -->
      <h3
        v-if="section.title"
        class="px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {{ $t(section.title) }}
      </h3>
      <!-- Section tree -->
      <TreeExplorerV2
        v-model:expanded-keys="expandedKeys"
        :root="section.root"
        :show-context-menu="false"
        @node-click="(node) => emit('nodeClick', node)"
      />
    </div>
    <Button
      variant="secondary"
      class="justify-start gap-3 ml-4 mt-2 px-4"
      @click="handleOpenManager"
    >
      <i class="icon-[lucide--puzzle] size-5 text-muted-foreground" />
      {{ $t('g.openManager') }}
    </Button>
  </TabsContent>
</template>

<script setup lang="ts">
import { TabsContent } from 'reka-ui'

import TreeExplorerV2 from '@/components/common/TreeExplorerV2.vue'
import Button from '@/components/ui/button/Button.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'

interface Section {
  title?: string
  root: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}

defineProps<{
  sections: Section[]
}>()

const expandedKeys = defineModel<string[]>('expandedKeys', { required: true })

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode<ComfyNodeDefImpl>]
}>()

const managerState = useManagerState()

async function handleOpenManager() {
  await managerState.openManager()
}
</script>
