<template>
  <ContextMenu
    ref="menu"
    :model="items"
    class="max-h-[80vh] overflow-y-auto md:max-h-none md:overflow-y-visible"
    :pt="{
      item: ({ context }) =>
        context.item.isSearch || context.item.isGroupLabel
          ? { class: searchItemSurfaceClass }
          : undefined,
      itemContent: ({ context }) =>
        context.item.isSearch || context.item.isGroupLabel
          ? { class: searchItemSurfaceClass }
          : undefined
    }"
    @hide="onHide"
  >
    <template #item="{ item, props, hasSubmenu }">
      <span
        v-if="item.isHeader"
        class="block truncate px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase"
      >
        {{ item.label }}
      </span>
      <span
        v-else-if="item.isGroupLabel"
        class="block truncate px-3 pt-1 pb-0.5 text-xs font-medium text-muted-foreground uppercase"
      >
        {{ item.label }}
      </span>
      <div
        v-else-if="item.isSearch"
        class="px-1 py-1.5"
        @click.stop
        @keydown.capture="onSearchKeydown"
      >
        <SearchInput
          ref="searchInput"
          v-model="query"
          size="md"
          :placeholder="t('contextMenu.Search')"
          :debounce-time="0"
        />
      </div>
      <a
        v-else
        v-bind="props.action"
        class="flex items-center gap-2 px-3 py-1.5"
      >
        <i v-if="item.icon" :class="cn(item.icon, 'size-4')" />
        <span class="flex-1 truncate">{{ item.label }}</span>
        <i
          v-if="hasSubmenu"
          class="icon-[lucide--chevron-right] size-4 opacity-60"
        />
      </a>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { buildLinkReleaseMenuItems } from './linkReleaseMenuModel'
import type { LinkReleaseContext } from './linkReleaseMenuModel'

const { context } = defineProps<{ context: LinkReleaseContext | null }>()

const emit = defineEmits<{
  selectNode: [nodeDef: ComfyNodeDefImpl]
  addReroute: []
  dismiss: []
}>()

const { t } = useI18n()
const nodeDefStore = useNodeDefStore()

const menu = ref<InstanceType<typeof ContextMenu>>()
const searchInput = ref<InstanceType<typeof SearchInput>>()
const query = ref('')
let actionTaken = false

const searchItemSurfaceClass =
  'bg-interface-menu-surface hover:bg-interface-menu-surface focus:bg-interface-menu-surface data-[p-focused=true]:bg-interface-menu-surface'

const defaultNodeDefs = computed<ComfyNodeDefImpl[]>(() => {
  if (!context?.dataType) return []
  const table = context.isFromOutput
    ? LiteGraph.slot_types_default_out
    : LiteGraph.slot_types_default_in
  const types = table?.[context.dataType] ?? []
  return types
    .map((type) => nodeDefStore.allNodeDefsByName[type])
    .filter((nodeDef): nodeDef is ComfyNodeDefImpl => Boolean(nodeDef))
})

const typeFilter = computed(() => {
  if (!context) return null
  const svc = nodeDefStore.nodeSearchService
  return {
    filterDef: context.isFromOutput
      ? svc.inputTypeFilter
      : svc.outputTypeFilter,
    value: context.dataType
  }
})

const compatibleNodes = computed<ComfyNodeDefImpl[]>(() => {
  if (!typeFilter.value) return []
  return nodeDefStore.nodeSearchService.searchNode('', [typeFilter.value], {
    limit: 500
  })
})

const searchResults = computed<ComfyNodeDefImpl[]>(() => {
  const q = query.value.trim()
  if (!q || !typeFilter.value) return []
  return nodeDefStore.nodeSearchService.searchNode(q, [typeFilter.value], {
    limit: 20
  })
})

function selectNode(nodeDef: ComfyNodeDefImpl) {
  actionTaken = true
  emit('selectNode', nodeDef)
  hide()
}

function addReroute() {
  actionTaken = true
  emit('addReroute')
  hide()
}

const items = computed<MenuItem[]>(() =>
  context
    ? buildLinkReleaseMenuItems({
        context,
        compatibleNodes: compatibleNodes.value,
        defaultNodeDefs: defaultNodeDefs.value,
        query: query.value,
        searchResults: searchResults.value,
        t,
        handlers: { selectNode, addReroute }
      })
    : []
)

function onSearchKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Enter') {
    const first = searchResults.value[0]
    if (first) selectNode(first)
  } else if (event.key === 'Escape') {
    hide()
  }
}

function show(event: MouseEvent) {
  actionTaken = false
  query.value = ''
  menu.value?.show(event)
  requestAnimationFrame(() => searchInput.value?.focus())
}

function hide() {
  menu.value?.hide()
}

function onHide() {
  if (actionTaken) {
    actionTaken = false
    return
  }
  emit('dismiss')
}

defineExpose({ show, hide })
</script>
