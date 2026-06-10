<template>
  <DropdownMenuSub v-model:open="open">
    <DropdownMenuSubTrigger :class="triggerClass">
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
        @open-auto-focus.prevent="focusSearch"
      >
        <div class="px-1 py-1.5">
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
              class="size-full min-w-0 bg-transparent text-sm text-base-foreground outline-none placeholder:text-muted-foreground"
              @keydown="onSearchKeydown"
            />
            <button
              v-if="query"
              type="button"
              :aria-label="t('g.clear')"
              class="shrink-0 cursor-pointer text-muted-foreground hover:text-base-foreground"
              @click="clearQuery"
            >
              <i class="icon-[lucide--x] size-4" />
            </button>
          </div>
        </div>
        <DropdownMenuSeparator class="m-1 h-px bg-border-subtle" />
        <DropdownMenuItem
          v-for="nodeDef in filteredNodes"
          :key="nodeDef.name"
          :class="itemClass"
          @select="emit('select', nodeDef)"
        >
          <span class="flex-1 truncate">{{ nodeDef.display_name }}</span>
        </DropdownMenuItem>
        <div
          v-if="filteredNodes.length === 0"
          class="px-3 py-2 text-sm text-muted-foreground"
        >
          {{ t('g.noResults') }}
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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import { filterNodesByName } from './linkReleaseMenuModel'
import type { LinkReleaseNodeCategory } from './linkReleaseMenuModel'

const { category, itemClass, contentClass } = defineProps<{
  category: LinkReleaseNodeCategory
  itemClass: string
  contentClass: string
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

function clearQuery() {
  query.value = ''
  searchInput.value?.focus()
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
