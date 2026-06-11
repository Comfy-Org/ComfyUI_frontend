<template>
  <DropdownMenuSub v-model:open="open">
    <DropdownMenuSubTrigger
      :class="triggerClass"
      @focus="open = true"
      @keydown="onTriggerKeydown"
      @blur="onTriggerBlur"
    >
      <i :class="cn(category.icon, 'size-4 shrink-0 opacity-80')" />
      <span class="flex-1 truncate">{{ t(category.labelKey) }}</span>
      <span
        class="rounded-full bg-interface-menu-keybind-surface-default px-1.5 text-xs text-muted-foreground"
      >
        {{ category.nodes.length }}
      </span>
      <i class="icon-[lucide--chevron-right] size-4 shrink-0 opacity-60" />
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <!--
        Opens to the right of the trigger; when there's no room, Floating UI
        flips it to the LEFT. Because submenus default to prioritize-position
        (offset -> flip -> shift), the flipped panel lands flush against the
        parent menu's left edge by its OWN width (no PrimeVue-style overlap that
        shifts by the parent item width). side-offset is negative so it overlaps
        the parent edge by 2px to bridge the hover gap, and collision-padding
        keeps an 8px viewport margin so it flips before touching the edge
        (mirrors DockFilterMenu's SUB_OVERLAP / M).
      -->
      <DropdownMenuSubContent
        :class="contentClass"
        side="right"
        align="start"
        :side-offset="-2"
        :align-offset="-5"
        :collision-padding="8"
        update-position-strategy="optimized"
        @open-auto-focus.prevent
        @entry-focus="onEntryFocus"
        @keydown.capture="redirectTypingToSearch"
      >
        <div class="p-.5 shrink-0">
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
              :placeholder="
                t('g.searchPlaceholder', { subject: t(category.labelKey) })
              "
              class="size-full min-w-0 appearance-none border-none bg-transparent text-sm text-base-foreground outline-none placeholder:text-muted-foreground"
              @keydown="onSearchKeydown"
            />
          </div>
        </div>
        <DropdownMenuSeparator
          class="-mx-1 my-1 h-px shrink-0 bg-border-subtle"
        />
        <div :class="scrollClass">
          <DropdownMenuItem
            v-for="nodeDef in filteredNodes"
            :key="nodeDef.name"
            :class="itemClass"
            @select="emit('select', nodeDef)"
          >
            <MiddleTruncate
              :text="nodeDef.display_name"
              class="min-w-0 flex-1 self-stretch"
            />
          </DropdownMenuItem>
          <div
            v-if="filteredNodes.length === 0"
            class="px-3 py-2 text-sm text-muted-foreground"
          >
            {{ t('g.noResults') }}
          </div>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import MiddleTruncate from './MiddleTruncate.vue'
import { filterNodesByName } from './linkReleaseMenuModel'
import type { LinkReleaseNodeCategory } from './linkReleaseMenuModel'

const { category, itemClass, contentClass, scrollClass } = defineProps<{
  category: LinkReleaseNodeCategory
  itemClass: string
  contentClass: string
  scrollClass: string
}>()

const emit = defineEmits<{
  select: [nodeDef: ComfyNodeDefImpl]
}>()

const { t } = useI18n()

const open = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement>()

const triggerClass = computed(() =>
  cn(itemClass, 'data-[state=open]:bg-interface-menu-component-surface-hovered')
)

const filteredNodes = computed(() =>
  filterNodesByName(category.nodes, query.value)
)

watch(open, (isOpen) => {
  if (!isOpen) query.value = ''
})

function focusSearch() {
  searchInput.value?.focus()
}

function submenuContent() {
  return searchInput.value?.closest<HTMLElement>('[role="menu"]') ?? null
}

// Step into the open submenu, landing on its search field.
function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'Enter') return
  event.preventDefault()
  open.value = true
  void nextTick(focusSearch)
}

// Close the preview when focus leaves the trigger to a sibling item rather
// than into the submenu content.
function onTriggerBlur(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && submenuContent()?.contains(next)) return
  open.value = false
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

// When the keyboard focus is on a submenu item, funnel printable keystrokes
// into this submenu's search field instead of Reka's item type-ahead.
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

function focusFirstNode(target: HTMLElement) {
  const panel = target.closest<HTMLElement>('[role="menu"]')
  panel
    ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
    ?.focus()
}

function onSearchKeydown(event: KeyboardEvent) {
  // Let Reka handle submenu/menu navigation keys natively.
  if (event.key === 'Escape' || event.key === 'ArrowLeft') return
  event.stopPropagation()
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusFirstNode(event.currentTarget as HTMLElement)
  } else if (event.key === 'Enter') {
    const first = filteredNodes.value[0]
    if (first) emit('select', first)
  }
}
</script>
