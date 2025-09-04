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

const items = ref(null)
const expandedKeys = ref<Record<string, boolean>>({})

watchDebounced(items,() => {
  console.log(items.value.map(i => `${i[0].title}: ${i[1].name}`))
  }, { debounce: 500 }
)

const widgetTree = computed(() => {
  const node = canvasStore.selectedItems[0] ?? {}
  const interiorNodes = node?.subgraph?.nodes ?? []
  if (!interiorNodes) {
    items.value = null
    return
  }
  node.widgets ??= []
  const intn = interiorNodes.map((n) =>
    n.widgets?.map((w) => [n, w, node]) ?? []).flat(1)
  //items.value = intn
  //TODO: filter enabled/disabled items while keeping order
  console.log(intn)
  return buildTree(intn, (item: [unknown, unknown]) =>
    [`${item[0].title}: ${item[1].name}`]
  )
})



const renderedRoot = computed<TreeExplorerNode<ComfyNodeDefImpl>>(() => {
  const fillNodeInfo = (node: TreeNode): TreeExplorerNode<ComfyNodeDefImpl> => {
    const children = node.children?.map(fillNodeInfo)

    return {
      key: node.key,
      label: node.leaf ? node.data.display_name : node.label,
      leaf: node.leaf,
      data: node.data,
      label: node.label,
      getIcon() {
          return 'pi pi-minus'
      },
      children,
      draggable: true,
    }
  }
  console.log(widgetTree.value)
  const ret =  fillNodeInfo(widgetTree.value)
  console.log(ret)
  return ret
})


</script>
