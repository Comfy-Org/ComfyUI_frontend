<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { watchDebounced } from '@vueuse/core'

import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'

import SearchBox from '@/components/common/SearchBox.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import SubgraphNodeWidget from '@/components/selectionbar/SubgraphNodeWidget.vue'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'
const { t } = useI18n()

const canvasStore = useCanvasStore()

const expandedKeys = ref<Record<string, boolean>>({})
const searchQuery = ref<string>('')

const triggerUpdate = ref(0)

const activeNode = computed(() => {
  return canvasStore.selectedItems[0]
})

function keyfn(item) {
      return `${item[0].title}(${item[0].id}): ${item[1].name}`
}
const activeWidgets = computed({
  get() {
    triggerUpdate.value
    const node = activeNode.value
    if (!node) return []
    const pw = node.properties.proxyWidgets ?? []
    return pw.map(([id, name]) => {
      const wNode = node.subgraph._nodes_by_id[id]
      const w = wNode.widgets.find((w) => w.name === name)
      return [wNode, w]
    })
  },
  set(value) {
    //map back to id/name
    const pw = value.map(([node, widget]) => [node.id, widget.name])
    activeNode.value.properties.proxyWidgets = pw
    //force trigger an update
    triggerUpdate.value++
    canvasStore.canvas.setDirty(true)
  }
})
function toggleVisibility(nodeId, widgetName, isShown) {
  const node = activeNode.value
  const { widgetStates } = useDomWidgetStore()
  if (!isShown) {
    const w = node.addProxyWidget(`${nodeId}`, widgetName)
    if (widgetStates.has(w.id)) {
      const widgetState = widgetStates.get(w.id)
      widgetState.active = true
      widgetState.widget = w
    }
  } else {
    const index = node.widgets.findIndex((w) => w.name === widgetName)
    if (index < 0) throw new Error("Can't disable missing widget")
    const [w] = node.widgets.splice(index, 1)
    if (widgetStates.has(w.id)) {
      widgetStates.get(w.id).active = false
    }
    const { properties } = node
    properties.proxyWidgets = properties.proxyWidgets.filter((p) => {
    return p[1] !== widgetName
      //NOTE: intentional loose as nodeId is often string/int
      || p[0] != nodeId})
  }
  triggerUpdate.value++
  useCanvasStore().canvas.setDirty(true)
}

const candidateWidgets = computed(() => {
  const node = canvasStore.selectedItems[0]
  if(!node) return []
  triggerUpdate.value//mark dependent
  const pw = node.properties.proxyWidgets ?? []
  const interiorNodes = node?.subgraph?.nodes ?? []
  node.widgets ??= []
  const intn = interiorNodes.flatMap((n) =>
    n.widgets?.map((w) => {
      return [n,w] ?? []
    }))
    //widget has connected link. Should not be displayed
    .filter(([_, w]) => !w.computedDisabled)
    .filter(([n,w]) => !pw.some(([pn,pw]) => n.id == pn && w.name == pw))
  //TODO: filter enabled/disabled items while keeping order
  return intn
})
const filteredCandidates = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return candidateWidgets.value
  return candidateWidgets.value.filter(([n,w]) =>
    n.title.toLowerCase().includes(query)
    || w.name.toLowerCase().includes(query)
  )
})
function showAll() {
  console.log('showall')
}
function hideAll() {
  console.log('hideall')
}

const filteredActive = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) {
    console.error("displaying filtered widgets with no search query")
    return activeWidgets.value
  }
  return activeWidgets.value.filter(([n,w]) =>
    n.title.toLowerCase().includes(query)
    || w.name.toLowerCase().includes(query)
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
          @search="handleSearch"
          />
    </template>
    <template #body>
      <div class="widgets-section">
        <div class="widgets-section-header">
          <div> {{t('subgraphStore.shown')}}</div>
          <a @click.stop="showAll" > {{t('subgraphStore.showAll')}}</a>
        </div>
        <div v-if="searchQuery"
          v-for="element in filteredActive" class="widget-container">
          <SubgraphNodeWidget :item="element" :node="activeNode"
          :toggleVisibility="toggleVisibility" :isShown="true"/>
        </div>
      <draggable
          v-model="activeWidgets"
          group="enabledWidgets"
          class="widget-container draggable-item"
          chosenClass="dragged-item"
          dragClass="dragged-item"
          :animation="100"
          @start="drag=true"
          @end="drag=false"
          item-key="id"
          v-else>
      <template #item="{element}">
        <SubgraphNodeWidget :item="element" :node="activeNode" :isShown="true"
          :toggleVisibility="toggleVisibility" :isDraggable="true"/>
      </template>
      </draggable>
      </div>
      <div class="widgets-section">
        <div class="widgets-section-header">
          <div> {{t('subgraphStore.hidden')}}</div>
          <a @click.stop="hideAll"> {{t('subgraphStore.hideAll')}}</a>
        </div>
        <div v-for="element in filteredCandidates" class="widget-container">
          <SubgraphNodeWidget :item="element" :node="activeNode"
          :toggleVisibility="toggleVisibility"/>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
</template>
<style scoped>
.widget-container {
  width: 100%
}
.widgets-section-header {
  display: flex;
  padding: 0 16px;
  justify-content: space-between;
  align-items: flex-end;
  align-self: stretch;
}
.widgets-section-header div {
  color: var(--color-text-secondary, #9C9EAB);
  /* body-text-badge */
  font-family: Inter;
  font-size: 9px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  text-transform: uppercase;
}
.widgets-section-header a {
  cursor: pointer;
  color: var(--color-base-blue-primary, #0B8CE9);
  text-align: right;

  /* body-text-caption */
  font-family: Inter;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

.widgets-section {
  display: flex;

  padding: 4px 0 16px 0;
  flex-direction: column;
  align-items: flex-start;
  align-self: stretch;
  border-bottom: 1px solid var(--color-node-divider, #2E3037);
}
.dragged-item {
  cursor: grabbing;
}
.draggable-item {
  cursor: grab;
}

</style>
