<template>
  <DropdownMenuRoot :open="open" :modal="false" @update:open="onOpenChange">
    <DropdownMenuTrigger as-child>
      <div
        aria-hidden="true"
        class="pointer-events-none fixed size-0"
        :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        side="bottom"
        align="start"
        :side-offset="4"
        :collision-padding="8"
        :class="contentClass"
        @open-auto-focus.prevent="focusSearch"
        @close-auto-focus.prevent
        @entry-focus="onEntryFocus"
        @keydown.capture="redirectTypingToSearch"
      >
        <DropdownMenuLabel
          v-if="headerLabel"
          class="flex shrink-0 items-center gap-2 p-2 text-xs font-medium text-muted-foreground uppercase"
        >
          <span class="flex size-4 shrink-0 items-center justify-center">
            <span
              class="size-4 rounded-full"
              :style="{ backgroundColor: slotColor }"
            />
          </span>
          <span class="truncate">{{ headerLabel }}</span>
        </DropdownMenuLabel>
        <div data-search-field class="p-.5 shrink-0">
          <div
            class="flex h-9 items-center gap-2 rounded-lg bg-secondary-background px-2"
          >
            <i
              class="icon-[lucide--search] size-4 shrink-0 text-muted-foreground"
            />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              :placeholder="t('contextMenu.Search')"
              class="size-full min-w-0 appearance-none border-none bg-transparent text-sm text-base-foreground outline-none placeholder:text-muted-foreground"
              @keydown="onRootSearchKeydown"
            />
          </div>
        </div>
        <DropdownMenuSeparator
          class="-mx-1 my-1 h-px shrink-0 bg-border-subtle"
        />

        <div :class="scrollClass">
          <template v-if="trimmedQuery">
            <DropdownMenuItem
              v-for="match in searchResults"
              :key="`${match.category.key}:${match.node.name}`"
              :class="itemClass"
              @select="selectNode(match.node)"
            >
              <i
                :class="cn(match.category.icon, 'size-4 shrink-0 opacity-80')"
              />
              <span class="flex min-w-0 flex-1 items-center gap-1">
                <span class="shrink-0 text-muted-foreground">
                  {{ t(match.category.labelKey) }}:
                </span>
                <MiddleTruncate
                  :text="match.node.display_name"
                  class="min-w-0 flex-1"
                />
              </span>
            </DropdownMenuItem>
            <div
              v-if="searchResults.length === 0"
              class="p-2 text-sm text-muted-foreground"
            >
              {{ t('g.noResults') }}
            </div>
          </template>

          <template v-else>
            <template v-if="suggestions.length">
              <DropdownMenuLabel
                class="block truncate p-2 text-xs font-medium text-muted-foreground uppercase"
              >
                {{ t('contextMenu.Most Relevant') }}
              </DropdownMenuLabel>
              <DropdownMenuItem
                v-for="nodeDef in suggestions"
                :key="nodeDef.name"
                :class="itemClass"
                @select="selectNode(nodeDef)"
              >
                <MiddleTruncate
                  :text="nodeDef.display_name"
                  class="min-w-0 flex-1"
                />
              </DropdownMenuItem>
            </template>

            <DropdownMenuSeparator
              v-if="suggestions.length && categories.length"
              class="-mx-1 my-1 h-px shrink-0 bg-border-subtle"
            />

            <template v-if="categories.length">
              <DropdownMenuLabel
                class="block truncate p-2 text-xs font-medium text-muted-foreground uppercase"
              >
                {{ t('contextMenu.Compatible Nodes') }}
              </DropdownMenuLabel>
              <LinkReleaseNodeSubmenu
                v-for="category in categories"
                :key="category.key"
                :category
                :item-class="itemClass"
                :content-class="submenuContentClass"
                :scroll-class="submenuScrollClass"
                @select="selectNode"
              />
            </template>
          </template>
        </div>

        <template v-if="!trimmedQuery">
          <DropdownMenuSeparator
            class="-mx-1 my-1 h-px shrink-0 bg-border-subtle"
          />
          <DropdownMenuItem
            :class="cn(itemClass, 'shrink-0')"
            @select="addReroute"
          >
            <i class="icon-[lucide--git-fork] size-4 shrink-0 opacity-80" />
            <span class="flex-1 truncate">
              {{ t('contextMenu.Add Reroute') }}
            </span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { getSlotColor } from '@/constants/slotColors'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import LinkReleaseNodeSubmenu from './LinkReleaseNodeSubmenu.vue'
import MiddleTruncate from './MiddleTruncate.vue'
import {
  buildLinkReleaseNodeCategories,
  getLinkReleaseHeaderLabel,
  getLinkReleaseSuggestions,
  searchLinkReleaseNodes
} from './linkReleaseMenuModel'
import type {
  LinkReleaseContext,
  LinkReleaseNodeMatch
} from './linkReleaseMenuModel'

const { context } = defineProps<{ context: LinkReleaseContext | null }>()

const emit = defineEmits<{
  selectNode: [nodeDef: ComfyNodeDefImpl]
  addReroute: []
  dismiss: []
}>()

const { t } = useI18n()
const nodeDefStore = useNodeDefStore()

const open = ref(false)
const position = ref({ x: 0, y: 0 })
const searchInput = ref<HTMLInputElement>()
const query = ref('')
let actionTaken = false

const contentClass =
  'z-1700 flex max-h-[min(80vh,var(--reka-dropdown-menu-content-available-height))] min-w-[260px] max-w-sm flex-col overflow-hidden rounded-lg border border-interface-menu-stroke bg-interface-menu-surface p-1 shadow-interface'
const scrollClass = 'overflow-y-auto overflow-x-hidden scrollbar-custom'
const submenuContentClass =
  'z-1700 flex w-sm flex-col overflow-hidden rounded-lg border border-interface-menu-stroke bg-interface-menu-surface p-1 shadow-interface'
const submenuScrollClass =
  'flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-custom'
const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-base-foreground outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-interface-menu-component-surface-hovered'

const headerLabel = computed(() =>
  context ? getLinkReleaseHeaderLabel(context) : ''
)

const slotColor = computed(() => getSlotColor(context?.dataType?.split(',')[0]))

const trimmedQuery = computed(() => query.value.trim())

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

const suggestions = computed(() =>
  getLinkReleaseSuggestions(defaultNodeDefs.value)
)
const categories = computed(() =>
  buildLinkReleaseNodeCategories(compatibleNodes.value)
)

const searchResults = computed<LinkReleaseNodeMatch[]>(() =>
  searchLinkReleaseNodes(categories.value, trimmedQuery.value)
)

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

function focusSearch() {
  searchInput.value?.focus()
}

function isPrintableKey(event: KeyboardEvent) {
  return (
    event.key.length === 1 &&
    event.key !== ' ' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  )
}

// When the keyboard focus is on a menu item, funnel printable keystrokes into
// the search field instead of letting Reka run its item type-ahead.
function redirectTypingToSearch(event: KeyboardEvent) {
  if (event.target === searchInput.value || !isPrintableKey(event)) return
  event.preventDefault()
  event.stopPropagation()
  query.value += event.key
  focusSearch()
}

// Reka refocuses the first item (scrolling the list to the top) whenever the
// menu regains focus, which fires as the pointer leaves an item while scrolling.
function onEntryFocus(event: Event) {
  event.preventDefault()
}

function focusFirstItem(target: HTMLElement) {
  const menu = target.closest<HTMLElement>('[role="menu"]')
  menu
    ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
    ?.focus()
}

function onRootSearchKeydown(event: KeyboardEvent) {
  // Let Reka close the menu natively on Escape.
  if (event.key === 'Escape') return
  event.stopPropagation()
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusFirstItem(event.currentTarget as HTMLElement)
  } else if (event.key === 'Enter' && trimmedQuery.value) {
    const first = searchResults.value[0]
    if (first) selectNode(first.node)
  }
}

function show(event: MouseEvent) {
  actionTaken = false
  query.value = ''
  position.value = { x: event.clientX, y: event.clientY }
  void nextTick(() => {
    open.value = true
  })
}

function hide() {
  open.value = false
}

function onOpenChange(value: boolean) {
  open.value = value
  if (value) return
  if (!actionTaken) emit('dismiss')
  actionTaken = false
}

defineExpose({ show, hide })
</script>
