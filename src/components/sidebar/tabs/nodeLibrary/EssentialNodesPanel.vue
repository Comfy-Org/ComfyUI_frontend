<template>
  <TabsContent value="essentials" class="min-h-0 flex-1 overflow-y-auto px-3">
    <div class="flex flex-col gap-2">
      <CollapsibleRoot
        v-for="folder in folders"
        :key="folder.key"
        v-model:open="folderStates[folder.key]"
        class="rounded-lg"
      >
        <CollapsibleTrigger
          class="group flex w-full items-center justify-between border-0 bg-transparent py-4 px-0 text-sm font-semibold text-neutral-200 cursor-pointer"
        >
          <span class="capitalize">{{ folder.label }}</span>
          <i
            :class="
              cn(
                'icon-[lucide--chevron-up] size-4 text-neutral-400 transition-transform duration-200',
                !folderStates[folder.key] && '-rotate-180'
              )
            "
          />
        </CollapsibleTrigger>
        <CollapsibleContent
          class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
        >
          <div class="grid grid-cols-3 gap-3">
            <EssentialNodeCard
              v-for="node in folder.children"
              :key="node.key"
              :node="node"
              @click="emit('nodeClick', $event)"
            />
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>
  </TabsContent>
</template>

<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  TabsContent
} from 'reka-ui'
import { computed, reactive, watch } from 'vue'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

import EssentialNodeCard from './EssentialNodeCard.vue'

const props = defineProps<{
  root: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

const expandedKeys = defineModel<string[]>('expandedKeys', { required: true })

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode<ComfyNodeDefImpl>]
}>()

function flattenLeaves(
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
): RenderedTreeExplorerNode<ComfyNodeDefImpl>[] {
  if (node.type === 'node') return [node]
  return node.children?.flatMap(flattenLeaves) ?? []
}

const folders = computed(() => {
  const topFolders =
    (props.root.children?.filter(
      (child) => child.type === 'folder'
    ) as RenderedTreeExplorerNode<ComfyNodeDefImpl>[]) ?? []

  return topFolders.map((folder) => ({
    ...folder,
    children: flattenLeaves(folder)
  }))
})

const folderStates = reactive<Record<string, boolean>>({})

watch(
  expandedKeys,
  (keys, oldKeys) => {
    const isInitial = oldKeys === undefined
    for (let i = 0; i < folders.value.length; i++) {
      const folder = folders.value[i]
      if (isInitial && keys.length === 0) {
        folderStates[folder.key] = i < 2
      } else {
        folderStates[folder.key] = keys.includes(folder.key)
      }
    }
  },
  { immediate: true }
)

watch(
  folderStates,
  (states) => {
    const newKeys = Object.entries(states)
      .filter(([, isOpen]) => isOpen)
      .map(([key]) => key)
    if (
      JSON.stringify(newKeys.sort()) !==
      JSON.stringify([...expandedKeys.value].sort())
    ) {
      expandedKeys.value = newKeys
    }
  },
  { deep: true }
)
</script>
