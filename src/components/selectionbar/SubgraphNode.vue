<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'

import SearchBox from '@/components/common/SearchBox.vue'
import SubgraphNodeWidget from '@/components/selectionbar/SubgraphNodeWidget.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  type ProxyWidgetsProperty,
  parseProxyWidgets
} from '@/schemas/proxyWidget'
import { useCanvasStore } from '@/stores/graphStore'

type WidgetItem = [LGraphNode, IBaseWidget]

const { t } = useI18n()

const canvasStore = useCanvasStore()

const searchQuery = ref<string>('')

const triggerUpdate = ref(0)

function toKey(item: WidgetItem) {
  return `${item[0].id}: ${item[1].name}`
}

const activeNode = computed(() => {
  const node = canvasStore.selectedItems[0]
  if (node instanceof SubgraphNode) return node
  return undefined
})

const activeWidgets = computed<WidgetItem[]>({
  get() {
    if (triggerUpdate.value < 0) console.log('unreachable')
    const node = activeNode.value
    if (!node) return []
    const pw = parseProxyWidgets(node.properties.proxyWidgets)
    return pw.flatMap(([id, name]: [string, string]) => {
      const wNode = node.subgraph._nodes_by_id[id]
      if (!wNode?.widgets) return []
      const w = wNode.widgets.find((w) => w.name === name)
      if (!w) return []
      return [[wNode, w]]
    })
  },
  set(value: WidgetItem[]) {
    const node = activeNode.value
    if (!node)
      throw new Error('Attempted to toggle widgets with no node selected')
    //map back to id/name
    const pw: ProxyWidgetsProperty = value.map(([node, widget]) => [
      `${node.id}`,
      widget.name
    ])
    node.properties.proxyWidgets = JSON.stringify(pw)
    //force trigger an update
    triggerUpdate.value++
  }
})
function toggleVisibility(
  nodeId: string,
  widgetName: string,
  isShown: boolean
) {
  const node = activeNode.value
  if (!node)
    throw new Error('Attempted to toggle widgets with no node selected')
  if (!isShown) {
    const proxyWidgets = parseProxyWidgets(node.properties.proxyWidgets)
    proxyWidgets.push([nodeId, widgetName])
    node.properties.proxyWidgets = JSON.stringify(proxyWidgets)
  } else {
    let pw = parseProxyWidgets(node.properties.proxyWidgets)
    pw = pw.filter(
      (p: [string, string]) => p[1] !== widgetName || p[0] !== nodeId
    )
    node.properties.proxyWidgets = JSON.stringify(pw)
  }
  triggerUpdate.value++
}

function nodeWidgets(n: LGraphNode): WidgetItem[] {
  if (!n.widgets) return []
  return n.widgets.map((w: IBaseWidget) => [n, w])
}

const candidateWidgets = computed<WidgetItem[]>(() => {
  const node = activeNode.value
  if (!node) return []
  if (triggerUpdate.value < 0) console.log('unreachable')
  const pw = parseProxyWidgets(node.properties.proxyWidgets)
  const interiorNodes = node.subgraph.nodes
  //node.widgets ??= []
  const allWidgets: WidgetItem[] = interiorNodes.flatMap(nodeWidgets)
  const filteredWidgets = allWidgets
    //widget has connected link. Should not be displayed
    .filter(([_, w]: WidgetItem) => !w.computedDisabled)
    .filter(
      ([n, w]: WidgetItem) =>
        !pw.some(([pn, pw]: [string, string]) => n.id == pn && w.name == pw)
    )
  return filteredWidgets
})
const filteredCandidates = computed<WidgetItem[]>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return candidateWidgets.value
  return candidateWidgets.value.filter(
    ([n, w]: WidgetItem) =>
      n.title.toLowerCase().includes(query) ||
      w.name.toLowerCase().includes(query)
  )
})
function showAll() {
  const node = activeNode.value
  if (!node) return //Not reachable
  const pw = parseProxyWidgets(node.properties.proxyWidgets)
  const toAdd: ProxyWidgetsProperty = filteredCandidates.value.map(
    ([n, w]: WidgetItem) => [`${n.id}`, w.name]
  )
  pw.push(...toAdd)
  node.properties.proxyWidgets = JSON.stringify(pw)
  triggerUpdate.value++
}
function hideAll() {
  const node = activeNode.value
  if (!node) return //Not reachable
  //Not great from a nesting perspective, but path is cold
  //and it cleans up potential error states
  const toKeep: ProxyWidgetsProperty = parseProxyWidgets(
    node.properties.proxyWidgets
  ).filter(
    ([nodeId, widgetName]) =>
      !filteredActive.value.some(
        ([n, w]: WidgetItem) => n.id == nodeId && w.name === widgetName
      )
  )
  node.properties.proxyWidgets = JSON.stringify(toKeep)
  triggerUpdate.value++
}

const filteredActive = computed<WidgetItem[]>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return activeWidgets.value
  return activeWidgets.value.filter(
    ([n, w]: WidgetItem) =>
      n.title.toLowerCase().includes(query) ||
      w.name.toLowerCase().includes(query)
  )
})
</script>
<template>
  <SidebarTabTemplate
    :title="'Parameters'"
    class="workflows-sidebar-tab bg-[var(--p-tree-background)]"
  >
    <template #header>
      <SearchBox
        v-model:modelValue="searchQuery"
        class="model-lib-search-box p-2 2xl:p-4"
        :placeholder="$t('g.search') + '...'"
      />
    </template>
    <template #body>
      <div v-if="filteredActive.length" class="widgets-section">
        <div class="widgets-section-header">
          <div>{{ t('subgraphStore.shown') }}</div>
          <a @click.stop="hideAll"> {{ t('subgraphStore.hideAll') }}</a>
        </div>
        <div v-if="searchQuery" class="w-full">
          <div
            v-for="element in filteredActive"
            :key="toKey(element)"
            class="w-full"
          >
            <SubgraphNodeWidget
              :node-id="`${element[0].id}`"
              :node-title="element[0].title"
              :widget-name="element[1].name"
              :toggle-visibility="toggleVisibility"
              :is-shown="true"
            />
          </div>
        </div>
        <draggable
          v-else
          v-model="activeWidgets"
          group="enabledWidgets"
          class="w-full cursor-grab"
          chosen-class="cursor-grabbing"
          drag-class="cursor-grabbing"
          :animation="100"
          item-key="id"
        >
          <template #item="{ element }">
            <SubgraphNodeWidget
              :node-id="`${element[0].id}`"
              :node-title="element[0].title"
              :widget-name="element[1].name"
              :is-shown="true"
              :toggle-visibility="toggleVisibility"
              :is-draggable="true"
            />
          </template>
        </draggable>
      </div>
      <div v-if="filteredCandidates.length" class="widgets-section">
        <div class="widgets-section-header">
          <div>{{ t('subgraphStore.hidden') }}</div>
          <a @click.stop="showAll"> {{ t('subgraphStore.showAll') }}</a>
        </div>
        <div
          v-for="element in filteredCandidates"
          :key="toKey(element)"
          class="w-full"
        >
          <SubgraphNodeWidget
            :node-id="`${element[0].id}`"
            :node-title="element[0].title"
            :widget-name="element[1].name"
            :toggle-visibility="toggleVisibility"
          />
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
</template>
<style scoped>
.widgets-section-header {
  display: flex;
  padding: 0 16px;
  justify-content: space-between;
}
.widgets-section-header div {
  color: var(--color-slate-100, #9c9eab);
  /* body-text-badge */
  font-family: Inter;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}
.widgets-section-header a {
  cursor: pointer;
  color: var(--color-blue-100, #0b8ce9);
  text-align: right;

  /* body-text-caption */
  font-family: Inter;
  font-size: 11px;
  font-weight: 400;
}

.widgets-section {
  padding: 4px 0 16px 0;
  border-bottom: 1px solid var(--color-node-divider, #2e3037);
}
</style>
