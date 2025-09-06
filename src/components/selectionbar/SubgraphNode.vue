<template>
  <SidebarTabTemplate
    :title="'Subgraph Node'"
    class="workflows-sidebar-tab bg-[var(--p-tree-background)]"
  >
  <template #body>
      <TreeExplorer
        v-model:expandedKeys="expandedKeys"
        :root="renderedRoot"
      >
        <template #node="{ node }">
        <SubgraphNodeWidget :node="node"/>
        </template>
      </TreeExplorer>
  </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { watchDebounced } from '@vueuse/core'
import OrderList from 'primevue/orderlist';

import { useI18n } from 'vue-i18n'

import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import SubgraphNodeWidget from '@/components/selectionbar/SubgraphNodeWidget.vue'
import { useCanvasStore } from '@/stores/graphStore'
import { buildTree } from '@/utils/treeUtil'
const { t } = useI18n()

const canvasStore = useCanvasStore()

const expandedKeys = ref<Record<string, boolean>>({})

const widgetTree = computed(() => {
  const node = canvasStore.selectedItems[0] ?? {}
  const interiorNodes = node?.subgraph?.nodes ?? []
  node.widgets ??= []
  const intn = interiorNodes.map((n) =>
    n.widgets?.map((w) => [n, w, node]) ?? []).flat(1)
    //widget has connected link. Should not be displayed
    .filter((i) => !i[1].computedDisabled)
  //TODO: filter enabled/disabled items while keeping order
  return buildTree(intn, (item: [unknown, unknown]) =>
    [`${item[0].title}(${item[0].id}): ${item[1].name}`]
  )
})

const renderedRoot = computed<TreeExplorerNode<ComfyNodeDefImpl>>(() => {
  const fillNodeInfo = (node: TreeNode): TreeExplorerNode<ComfyNodeDefImpl> => {
    const children = node.children?.map(fillNodeInfo)

    return {
      key: node.key,
      leaf: node.leaf,
      data: node.data,
      label: node.label,
      getIcon() {
          return 'pi pi-minus'
      },
      children,
      onToggle: () => console.log(widgetTree,node),
      draggable: true,
    }
  }
  const ret =  fillNodeInfo(widgetTree.value)
  return ret
})


</script>
