<template>
  <div class="flex h-full flex-1 flex-col">
    <div
      v-for="(section, index) in sections"
      :key="section.title ?? index"
      class="h-full flex-1 overflow-y-auto"
    >
      <!-- Section header -->
      <h3
        v-if="section.title"
        class="mb-0 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {{ section.title }}
      </h3>
      <!-- Section tree -->
      <TreeExplorerV2
        v-model:expanded-keys="expandedKeys"
        :root="section.root"
        :show-context-menu="false"
        @node-click="(node) => emit('nodeClick', node)"
      />
    </div>
    <div class="flex-none border-t border-border-default py-3 text-center">
      <Button
        variant="secondary"
        class="justify-start gap-3"
        @click="handleOpenManager"
      >
        <i class="icon-[lucide--blocks] size-5 text-muted-foreground" />
        {{ $t('g.manageExtensions') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import TreeExplorerV2 from '@/components/common/TreeExplorerV2.vue'
import Button from '@/components/ui/button/Button.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type {
  NodeLibrarySection,
  RenderedTreeExplorerNode
} from '@/types/treeExplorerTypes'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'

defineProps<{
  sections: NodeLibrarySection<ComfyNodeDefImpl>[]
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
