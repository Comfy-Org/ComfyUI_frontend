<script setup lang="ts">
import { computedAsync, refDebounced } from '@vueuse/core'
import Popover from 'primevue/popover'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'

import FormDropdownInput from './FormDropdownInput.vue'
import FormDropdownMenu from './FormDropdownMenu.vue'
import { defaultSearcher, getDefaultSortOptions } from './shared'
import type { FormDropdownItem, LayoutMode, SortOption } from './types'

interface Props {
  items: FormDropdownItem[]
  /** Items used for display in the input field. Falls back to items if not provided. */
  displayItems?: FormDropdownItem[]
  placeholder?: string
  /**
   * If true, allows multiple selections. If a number is provided,
   * it specifies the maximum number of selections allowed.
   */
  multiple?: boolean | number

  uploadable?: boolean
  disabled?: boolean
  accept?: string
  filterOptions?: FilterOption[]
  sortOptions?: SortOption[]
  showOwnershipFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
  showBaseModelFilter?: boolean
  baseModelOptions?: FilterOption[]
  /** Names pinned to the top of the menu under a "Recently used" heading. */
  pinTopNames?: string[]
  isSelected?: (
    selected: Set<string>,
    item: FormDropdownItem,
    index: number
  ) => boolean
  searcher?: (
    query: string,
    items: FormDropdownItem[],
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<FormDropdownItem[]>
}

const { t } = useI18n()

const {
  placeholder,
  multiple = false,
  uploadable = false,
  disabled = false,
  accept,
  filterOptions = [],
  sortOptions = getDefaultSortOptions(),
  showOwnershipFilter,
  ownershipOptions,
  showBaseModelFilter,
  baseModelOptions,
  pinTopNames,
  isSelected = (selected, item, _index) => selected.has(item.id),
  searcher = defaultSearcher,
  items
} = defineProps<Props>()

const placeholderText = computed(
  () => placeholder ?? t('widgets.uploadSelect.placeholder')
)

const selected = defineModel<Set<string>>('selected', {
  default: () => new Set()
})
const filterSelected = defineModel<string>('filterSelected', { default: '' })
const sortSelected = defineModel<string>('sortSelected', {
  default: 'default'
})
const layoutMode = defineModel<LayoutMode>('layoutMode', {
  default: 'grid'
})
const files = defineModel<File[]>('files', { default: () => [] })
const searchQuery = defineModel<string>('searchQuery', { default: '' })
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected', {
  default: 'all'
})
const baseModelSelected = defineModel<Set<string>>('baseModelSelected', {
  default: () => new Set()
})
const isOpen = defineModel<boolean>('isOpen', { default: false })

const toastStore = useToastStore()

// Mount to body so the popover escapes the canvas's TransformPane and the
// node's own translate. Inside those transforms, position:fixed re-applies
// the ancestor transforms to our viewport coords, producing a drift that
// grows with the node's viewport X. Body-mounting sidesteps that entirely,
// then placePopover() scales the panel back to match the canvas zoom.
const overlayProps = useTransformCompatOverlayProps({ appendTo: 'body' })

const popoverRef = ref<InstanceType<typeof Popover>>()
const triggerAnchorRef = useTemplateRef<HTMLElement>('triggerAnchorRef')
const triggerRef =
  useTemplateRef<InstanceType<typeof FormDropdownInput>>('triggerRef')
// PrimeVue Popover with appendTo:'body' teleports the overlay outside this
// component; popoverRef.$el points at the empty anchor, not the visible
// overlay. We tag the overlay root with a unique id via :pt so we can look
// it up in the DOM and write inline position styles directly on it.
const popoverElementId = useId()
const displayedSearchQuery = ref('')
const isFiltering = ref(false)

const maxSelectable = computed(() => {
  if (multiple === true) return Infinity
  if (typeof multiple === 'number') return multiple
  return 1
})
const isSingleSelect = computed(() => maxSelectable.value === 1)

const debouncedSearchQuery = refDebounced(searchQuery, 250, { maxWait: 1000 })

const filteredItems = computedAsync(
  async (onCancel) => {
    if (!isOpen.value) {
      displayedSearchQuery.value = ''
      return items
    }

    const query = debouncedSearchQuery.value
    let cancelled = false
    let cleanupFn: (() => void) | undefined
    onCancel(() => {
      cancelled = true
      cleanupFn?.()
    })

    const result = await searcher(query, items, (cb) => {
      cleanupFn = cb
    })
    if (!cancelled) displayedSearchQuery.value = query
    return result
  },
  items,
  {
    evaluating: isFiltering
  }
)

const defaultSorter = computed<SortOption['sorter']>(() => {
  const sorter = sortOptions.find((option) => option.id === 'default')?.sorter
  return sorter || (({ items: i }) => i.slice())
})
const selectedSorter = computed<SortOption['sorter']>(() => {
  if (sortSelected.value === 'default') return defaultSorter.value
  const sorter = sortOptions.find(
    (option) => option.id === sortSelected.value
  )?.sorter
  return sorter || defaultSorter.value
})
const sortedItems = computed(() => {
  if (!isOpen.value) {
    return items
  }

  return selectedSorter.value({ items: filteredItems.value }) || []
})
const isShowingCurrentSearchResults = computed(
  () =>
    isOpen.value &&
    isSingleSelect.value &&
    !isFiltering.value &&
    searchQuery.value.trim() !== '' &&
    displayedSearchQuery.value === searchQuery.value &&
    sortedItems.value.length > 0
)

const candidateIndex = computed(() =>
  isShowingCurrentSearchResults.value ? 0 : -1
)
const candidateLabel = computed(() => {
  const candidate = sortedItems.value[candidateIndex.value]
  return candidate?.label ?? candidate?.name
})

function internalIsSelected(item: FormDropdownItem, index: number): boolean {
  return isSelected(selected.value, item, index)
}

// Position tracking for the body-mounted popover. The popover lives outside
// the canvas transform, but we want it to follow the node when the user pans
// or zooms. Re-read the node's screen rect every animation frame while open.
let positionRaf: number | null = null

function placePopover(nodeEl: HTMLElement) {
  const popoverEl = document.getElementById(popoverElementId)
  if (!popoverEl) return
  const rect = nodeEl.getBoundingClientRect()
  // Cumulative canvas scale: node screen width / its local CSS width. Captures
  // the canvas TransformPane's scale (and any other ancestor scales) without
  // needing to parse transform matrices.
  const scale = nodeEl.offsetWidth > 0 ? rect.width / nodeEl.offsetWidth : 1
  const popoverScreenWidth =
    (popoverEl.offsetWidth || nodeEl.offsetWidth) * scale
  const popoverScreenHeight = popoverEl.offsetHeight * scale

  // Anchor to the node's right edge, top-aligned. Flip to the left side when
  // there isn't room on the right, then clamp into the viewport.
  let left = rect.right + 4
  if (left + popoverScreenWidth > window.innerWidth - 8) {
    const flipped = rect.left - popoverScreenWidth - 4
    left =
      flipped >= 8
        ? flipped
        : Math.max(8, window.innerWidth - popoverScreenWidth - 8)
  }

  const maxTop = Math.max(8, window.innerHeight - popoverScreenHeight - 8)
  const top = Math.max(8, Math.min(rect.top, maxTop))

  popoverEl.style.position = 'fixed'
  popoverEl.style.top = `${top}px`
  popoverEl.style.left = `${left}px`
  popoverEl.style.right = 'auto'
  popoverEl.style.bottom = 'auto'
  // Scale the popover so it visually matches the node's current size on the
  // canvas — full-size at zoom 1, smaller as the user zooms out, etc.
  popoverEl.style.transformOrigin = 'top left'
  popoverEl.style.transform = `scale(${scale})`
  popoverEl.style.minWidth = `${nodeEl.offsetWidth}px`
}

function stopPositionTracking() {
  if (positionRaf !== null) {
    cancelAnimationFrame(positionRaf)
    positionRaf = null
  }
}

function startPositionTracking(nodeEl: HTMLElement) {
  const tick = () => {
    placePopover(nodeEl)
    positionRaf = requestAnimationFrame(tick)
  }
  // Run once on nextTick to claim styles before PrimeVue's onEnter
  // absolutePosition() lands, then again on rAF to win the race, then loop.
  void nextTick(() => placePopover(nodeEl))
  stopPositionTracking()
  positionRaf = requestAnimationFrame(tick)
}

// Custom outside-click dismissal that distinguishes a click from a drag.
// PrimeVue's built-in `dismissable` closes on any pointerdown outside the
// popover — which fires on canvas pan, accidentally closing the picker.
// Track pointerdown→pointerup and only dismiss if the pointer didn't travel
// far (a real click), and the down/up both landed outside the popover.
const OUTSIDE_DRAG_THRESHOLD_PX = 5
let pointerDownInfo: { x: number; y: number; outside: boolean } | null = null

function isInsidePopover(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('[data-form-dropdown-portal]') !== null
}

function isInsideTrigger(target: EventTarget | null): boolean {
  const triggerEl = triggerAnchorRef.value
  if (!triggerEl || !(target instanceof Node)) return false
  return triggerEl.contains(target)
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value) return
  const insidePopover = isInsidePopover(event.target)
  const insideTrigger = isInsideTrigger(event.target)
  pointerDownInfo = {
    x: event.clientX,
    y: event.clientY,
    outside: !insidePopover && !insideTrigger
  }
}

function handleDocumentPointerUp(event: PointerEvent) {
  if (!isOpen.value) return
  const info = pointerDownInfo
  pointerDownInfo = null
  if (!info || !info.outside) return
  if (isInsidePopover(event.target) || isInsideTrigger(event.target)) return
  const dx = event.clientX - info.x
  const dy = event.clientY - info.y
  if (dx * dx + dy * dy > OUTSIDE_DRAG_THRESHOLD_PX ** 2) return
  closeDropdown()
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    document.addEventListener('pointerup', handleDocumentPointerUp, true)
  } else {
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    document.removeEventListener('pointerup', handleDocumentPointerUp, true)
    pointerDownInfo = null
    stopPositionTracking()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('pointerup', handleDocumentPointerUp, true)
  stopPositionTracking()
})

const toggleDropdown = (event: Event) => {
  if (disabled) return
  if (popoverRef.value && triggerAnchorRef.value) {
    popoverRef.value.toggle?.(event, triggerAnchorRef.value)
    isOpen.value = !isOpen.value
    const nodeAnchor =
      triggerAnchorRef.value.closest<HTMLElement>('[data-node-id]')
    if (nodeAnchor && isOpen.value) {
      startPositionTracking(nodeAnchor)
    } else if (!isOpen.value) {
      stopPositionTracking()
    }
  }
}

function focusTrigger() {
  triggerRef.value?.focus()
}

const closeDropdown = ({ restoreFocus = false } = {}) => {
  if (popoverRef.value) {
    popoverRef.value.hide?.()
    isOpen.value = false
  }

  if (restoreFocus) focusTrigger()
}

function handleFileChange(event: Event) {
  if (disabled) return
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (target.files) {
    files.value = Array.from(target.files)
  }
  target.value = ''
}

function handleSelection(item: FormDropdownItem, index: number) {
  if (disabled) return
  const sel = selected.value
  if (internalIsSelected(item, index)) {
    sel.delete(item.id)
  } else {
    if (sel.size < maxSelectable.value) {
      sel.add(item.id)
    } else if (maxSelectable.value === 1) {
      sel.clear()
      sel.add(item.id)
    } else {
      toastStore.addAlert(t('widgets.uploadSelect.maxSelectionReached'))
      return
    }
  }
  selected.value = new Set(sel)

  if (maxSelectable.value === 1) {
    closeDropdown({ restoreFocus: true })
  }
}

async function getTopSearchResult() {
  const query = searchQuery.value
  if (query.trim() === '') return

  const sourceItems = items
  const matches =
    isShowingCurrentSearchResults.value && displayedSearchQuery.value === query
      ? filteredItems.value
      : await searcher(query, sourceItems, () => {})

  if (query !== searchQuery.value || sourceItems !== items || !isOpen.value) {
    return
  }

  return selectedSorter.value({ items: matches })?.[0]
}

async function selectTopSearchResult() {
  try {
    if (disabled || !isOpen.value || !isSingleSelect.value) return
    const topResult = await getTopSearchResult()
    if (!topResult) return
    handleSelection(topResult, 0)
  } catch (error) {
    console.error('[FormDropdown] search selection failed', error)
  }
}

function handleSearchEnter() {
  void selectTopSearchResult()
}
</script>

<template>
  <div ref="triggerAnchorRef">
    <FormDropdownInput
      ref="triggerRef"
      :files
      :is-open
      :placeholder="placeholderText"
      :items
      :display-items
      :max-selectable
      :selected
      :uploadable
      :disabled
      :accept
      @select-click="toggleDropdown"
      @file-change="handleFileChange"
    />
    <Popover
      ref="popoverRef"
      :dismissable="false"
      :close-on-escape="true"
      :append-to="overlayProps.appendTo"
      :auto-z-index="false"
      unstyled
      :pt="{
        root: {
          id: popoverElementId,
          'data-form-dropdown-portal': 'true',
          // Sit below the app chrome (side panel/splitter z-999, top bar
          // z-1001) so panning the canvas tucks the picker under them, while
          // still floating above the canvas.
          class: 'absolute z-[998]'
        },
        content: {
          class: ['bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg']
        }
      }"
      @hide="isOpen = false"
    >
      <FormDropdownMenu
        v-model:filter-selected="filterSelected"
        v-model:layout-mode="layoutMode"
        v-model:sort-selected="sortSelected"
        v-model:search-query="searchQuery"
        v-model:ownership-selected="ownershipSelected"
        v-model:base-model-selected="baseModelSelected"
        :filter-options
        :sort-options
        :show-ownership-filter
        :ownership-options
        :show-base-model-filter
        :base-model-options
        :uploadable
        :accept
        :pin-top-names="pinTopNames"
        :disabled
        :items="sortedItems"
        :candidate-index
        :candidate-label
        :is-selected="internalIsSelected"
        :max-selectable
        @close="closeDropdown"
        @search-enter="handleSearchEnter"
        @item-click="handleSelection"
        @file-change="handleFileChange"
      />
    </Popover>
  </div>
</template>
