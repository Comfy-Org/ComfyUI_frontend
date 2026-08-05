<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import type { SelectOption } from '@/components/ui/select/types'
import { cn } from '@comfyorg/tailwind-utils'

/**
 * Filter menu in the UX the team is standardizing on (Pablo, 08-05): a list
 * of facets, and picking one opens its values in a panel beside it rather
 * than replacing the list — so you keep sight of which facet you're in and
 * can jump between them without going back first.
 */
export interface FilterMenuFacet {
  key: string
  label: string
  icon: string
  options: SelectOption[]
  selectedValues: string[]
  /** Multi-select is the default; single-select facets show a tick instead. */
  mode: 'single' | 'multiple'
  /** Value that counts as "nothing chosen" for single-select facets. */
  emptyValue?: string
}

const SUBMENU_WIDTH = 288
const SUBMENU_MAX_HEIGHT = 380
const VIEWPORT_MARGIN = 12

const { facets } = defineProps<{ facets: FilterMenuFacet[] }>()

const emit = defineEmits<{
  toggle: [facetKey: string, value: string]
  clearFacet: [facetKey: string]
  clearAll: []
}>()

const rootRef = useTemplateRef<HTMLElement>('rootRef')
const searchRef = useTemplateRef<HTMLInputElement>('searchRef')
const openFacetKey = ref<string | null>(null)
const query = ref('')
const submenuPos = ref({ left: 0, top: 0 })

const openFacet = computed(
  () => facets.find((f) => f.key === openFacetKey.value) ?? null
)

function selectedCount(facet: FilterMenuFacet) {
  return facet.selectedValues.filter((v) => v !== facet.emptyValue).length
}

const totalSelected = computed(() =>
  facets.reduce((total, facet) => total + selectedCount(facet), 0)
)

const visibleOptions = computed(() => {
  const facet = openFacet.value
  if (!facet) return []
  const q = query.value.toLowerCase().trim()
  const options = q
    ? facet.options.filter((o) => o.name.toLowerCase().includes(q))
    : facet.options
  // Chosen values first, so a long list never buries what's already applied.
  const isOn = (o: SelectOption) => facet.selectedValues.includes(o.value)
  return [...options.filter(isOn), ...options.filter((o) => !isOn(o))]
})

/**
 * Beside the menu, aligned to the row you clicked. Measured per open — the
 * popover can sit anywhere depending on the sidebar's width and position, and
 * a rect cached from a previous open would be stale.
 */
function positionSubmenu(row: HTMLElement) {
  const panel = rootRef.value?.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  if (!panel) return
  const rightOf = panel.right + 4
  const left =
    rightOf + SUBMENU_WIDTH + VIEWPORT_MARGIN <= window.innerWidth
      ? rightOf
      : Math.max(VIEWPORT_MARGIN, panel.left - 4 - SUBMENU_WIDTH)
  submenuPos.value = {
    left,
    top: Math.max(
      VIEWPORT_MARGIN,
      Math.min(rowRect.top, window.innerHeight - SUBMENU_MAX_HEIGHT)
    )
  }
}

async function openFacetPanel(key: string, event: MouseEvent) {
  const sameFacet = openFacetKey.value === key
  positionSubmenu(event.currentTarget as HTMLElement)
  openFacetKey.value = sameFacet ? null : key
  query.value = ''
  if (openFacetKey.value) {
    await nextTick()
    searchRef.value?.focus()
  }
}

function closeSubmenu() {
  openFacetKey.value = null
  query.value = ''
}

function isSelected(facet: FilterMenuFacet, option: SelectOption) {
  return facet.selectedValues.includes(option.value)
}

function onOptionClick(facet: FilterMenuFacet, option: SelectOption) {
  emit('toggle', facet.key, option.value)
  // Multi-select stays open — picking several in a row is the point. Only a
  // single-select facet is a decision that ends the interaction.
  if (facet.mode === 'single') closeSubmenu()
}

/** Escape closes the submenu before it reaches the popover. */
function onEscape(event: KeyboardEvent) {
  if (openFacetKey.value) {
    event.stopPropagation()
    closeSubmenu()
  }
}

// The submenu is teleported, so a click in it isn't "inside" the menu; close
// it only for clicks that land outside both.
useEventListener(document, 'pointerdown', (event) => {
  if (!openFacetKey.value) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('#templates-filter-submenu')) return
  if (rootRef.value?.contains(target)) return
  closeSubmenu()
})

const rowClass =
  'flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 text-left text-sm text-base-foreground outline-none hover:bg-secondary-background-hover'
</script>

<template>
  <div
    ref="rootRef"
    class="flex w-56 flex-col"
    data-testid="template-filter-bar"
    @keydown.escape="onEscape"
  >
    <div class="flex flex-col p-1">
      <button
        v-for="facet in facets"
        :key="facet.key"
        type="button"
        :aria-expanded="openFacetKey === facet.key"
        :data-testid="`template-filter-facet-${facet.key}`"
        :class="
          cn(rowClass, openFacetKey === facet.key && 'bg-secondary-background')
        "
        @click="openFacetPanel(facet.key, $event)"
      >
        <i :class="cn(facet.icon, 'size-4 shrink-0 text-muted-foreground')" />
        <span class="min-w-0 flex-1 truncate">{{ facet.label }}</span>
        <span
          v-if="selectedCount(facet) > 0"
          class="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary-background text-2xs font-semibold text-base-foreground"
        >
          {{ selectedCount(facet) }}
        </span>
        <i
          class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground"
        />
      </button>
    </div>

    <div
      v-if="totalSelected > 0"
      class="-mx-2 mt-1 border-t border-border-subtle px-3 pt-2 pb-1"
    >
      <button
        type="button"
        class="cursor-pointer border-none bg-transparent p-0 text-xs text-muted-foreground underline underline-offset-2 outline-none hover:text-base-foreground"
        @click="emit('clearAll')"
      >
        {{ $t('templateWorkflows.clearAllFilters') }}
      </button>
    </div>

    <!-- Values panel, teleported so it can sit outside the popover's box. -->
    <Teleport to="body">
      <div
        v-if="openFacet"
        id="templates-filter-submenu"
        class="fixed z-3000 flex w-72 flex-col rounded-lg border border-border-subtle bg-base-background shadow-xl"
        :style="{ left: `${submenuPos.left}px`, top: `${submenuPos.top}px` }"
        data-testid="template-filter-submenu"
        @keydown.escape.stop="closeSubmenu"
      >
        <div
          class="flex items-center gap-2 border-b border-border-subtle px-3 py-1"
        >
          <i
            class="icon-[lucide--search] size-3.5 shrink-0 text-muted-foreground"
          />
          <input
            ref="searchRef"
            v-model="query"
            :placeholder="`${$t('g.search')}...`"
            class="h-9 w-full min-w-0 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div
          class="flex scrollbar-custom max-h-64 flex-col overflow-y-auto p-1"
        >
          <button
            v-for="option in visibleOptions"
            :key="option.value"
            type="button"
            :class="rowClass"
            @click="onOptionClick(openFacet, option)"
          >
            <span
              v-if="openFacet.mode === 'multiple'"
              :class="
                cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors duration-200',
                  isSelected(openFacet, option)
                    ? 'bg-primary-background'
                    : 'bg-secondary-background'
                )
              "
            >
              <i
                v-if="isSelected(openFacet, option)"
                class="icon-[lucide--check] text-xs font-bold text-base-foreground"
              />
            </span>
            <span class="min-w-0 flex-1 truncate">{{ option.name }}</span>
            <i
              v-if="
                openFacet.mode === 'single' && isSelected(openFacet, option)
              "
              class="icon-[lucide--check] size-4 shrink-0"
            />
          </button>

          <p
            v-if="visibleOptions.length === 0"
            class="m-0 px-2 py-3 text-center text-xs text-muted-foreground"
          >
            {{ $t('g.noResultsFound') }}
          </p>
        </div>

        <div
          v-if="selectedCount(openFacet) > 0"
          class="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2"
        >
          <span class="truncate text-xs text-muted-foreground">
            {{ $t('g.itemsSelected', { count: selectedCount(openFacet) }) }}
          </span>
          <button
            type="button"
            class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-xs text-base-foreground underline underline-offset-2 outline-none hover:text-muted-foreground"
            @click="emit('clearFacet', openFacet.key)"
          >
            {{ $t('g.clearAll') }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
