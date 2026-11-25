<script setup lang="ts">
import {
  StorageSerializers,
  computedAsync,
  refDebounced,
  unrefElement,
  useEventListener
} from '@vueuse/core'
import { PopoverAnchor, PopoverRoot } from 'reka-ui'
import type { ComponentPublicInstance } from 'vue'
import { computed, inject, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { usePopoverViewportDismiss } from '@comfyorg/design-system/lib/popover/usePopoverViewportDismiss'
import { useToast } from '@/components/ui/toast/toastStore'
import { useSafeSessionStorage } from '@/platform/storage/useSafeStorage'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@comfyorg/assets-core/filtering'
import { isPaged, pagedItems, WrappedList } from '@/utils/pagedList'
import type { MaybePaged } from '@/utils/pagedList'

import FormDropdownInput from './FormDropdownInput.vue'
import FormDropdownMenu from './FormDropdownMenu.vue'
import FormDropdownResizeHandle from './FormDropdownResizeHandle.vue'
import type { PanelSize, ResizeHandle } from './resizePanel'
import {
  DROPDOWN_PANEL_CLASS,
  defaultSearcher,
  getDefaultSortOptions
} from './shared'
import { AssetKindKey } from './types'
import type {
  FormDropdownItem,
  LayoutMode,
  SortOption,
  ThumbnailSize
} from './types'

interface Props {
  inputId?: string
  items: MaybePaged<FormDropdownItem>
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
  isSelected?: (
    selected: Set<string>,
    item: FormDropdownItem,
    index: number
  ) => boolean
  isUploading?: boolean
  searcher?: (
    query: string,
    items: readonly FormDropdownItem[],
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<readonly FormDropdownItem[]>
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

const toast = useToast()
const canvasStore = useCanvasStore()
const assetKind = inject(AssetKindKey)
const hasThumbnailSizes = computed(
  () => assetKind?.value === 'image' || assetKind?.value === 'video'
)
const thumbnailSize = ref<ThumbnailSize>('standard')
let canvasPointerId: number | undefined
const triggerAnchorRef = useTemplateRef<HTMLElement>('triggerAnchorRef')
const menuRef = useTemplateRef<ComponentPublicInstance>('menuRef')
const triggerRef =
  useTemplateRef<InstanceType<typeof FormDropdownInput>>('triggerRef')
const panelSize = useSafeSessionStorage<PanelSize | undefined>(
  'Comfy.FormDropdown.PanelSize',
  undefined,
  { serializer: StorageSerializers.object }
)
const RESIZE_HANDLES: ResizeHandle[] = [
  'left-edge',
  'free-edge',
  'left-corner',
  'right-corner'
]
const alignOffset = ref(0)
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
      return pagedItems(items).slice()
    }

    const query = debouncedSearchQuery.value
    let cancelled = false
    let cleanupFn: (() => void) | undefined
    onCancel(() => {
      cancelled = true
      cleanupFn?.()
    })

    const result = await searcher(query, pagedItems(items).slice(), (cb) => {
      cleanupFn = cb
    })
    if (!cancelled) displayedSearchQuery.value = query
    return result
  },
  pagedItems(items).slice(),
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
    return pagedItems(items).slice()
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

const toggleDropdown = () => {
  if (disabled) return
  isOpen.value = !isOpen.value
}

function focusTrigger() {
  triggerRef.value?.focus()
}

const closeDropdown = ({ restoreFocus = false } = {}) => {
  isOpen.value = false

  if (restoreFocus) focusTrigger()
}

useEventListener(
  window,
  'pointerdown',
  (event) => {
    if (!isOpen.value) return
    const menuEl = unrefElement(menuRef)
    const triggerEl = triggerAnchorRef.value
    const path = event.composedPath()
    if (menuEl && path.includes(menuEl)) return
    if (triggerEl && path.includes(triggerEl)) return
    if (path.some(isInsideDropdownPanel)) return
    const canvas = canvasStore.canvas?.canvas
    if (
      canvas &&
      ((event.button === 0 && path.includes(canvas)) ||
        (event.button === 1 &&
          canvas.parentElement &&
          path.includes(canvas.parentElement)))
    ) {
      canvasPointerId = event.pointerId
      return
    }
    closeDropdown()
  },
  { capture: true }
)

function isInsideDropdownPanel(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    target.classList.contains(DROPDOWN_PANEL_CLASS)
  )
}

useEventListener(
  window,
  'pointerup',
  (event) => {
    if (event.pointerId !== canvasPointerId) return
    canvasPointerId = undefined
    const canvas = canvasStore.canvas
    const wasPan = canvas?.dragging_canvas && canvas.pointer.dragStarted
    if (isOpen.value && !wasPan) closeDropdown()
  },
  { capture: true }
)

useEventListener(
  window,
  'pointercancel',
  (event) => {
    if (event.pointerId === canvasPointerId) canvasPointerId = undefined
  },
  { capture: true }
)

usePopoverViewportDismiss(isOpen, triggerAnchorRef)

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
  const itemIsSelected = internalIsSelected(item, index)
  if (isSingleSelect.value && itemIsSelected) {
    closeDropdown({ restoreFocus: true })
    return
  }

  const sel = selected.value
  if (itemIsSelected) {
    sel.delete(item.id)
  } else {
    if (sel.size < maxSelectable.value) {
      sel.add(item.id)
    } else if (maxSelectable.value === 1) {
      sel.clear()
      sel.add(item.id)
    } else {
      toast.warning(t('widgets.uploadSelect.maxSelectionReached'))
      return
    }
  }
  selected.value = new Set(sel)

  if (isSingleSelect.value) {
    closeDropdown({ restoreFocus: true })
  }
}

async function getTopSearchResult() {
  const query = searchQuery.value
  if (query.trim() === '') return

  const sourceItems = pagedItems(items)
  const matches =
    isShowingCurrentSearchResults.value && displayedSearchQuery.value === query
      ? filteredItems.value
      : await searcher(query, sourceItems.slice(), () => {})

  if (
    query !== searchQuery.value ||
    sourceItems !== pagedItems(items) ||
    !isOpen.value
  ) {
    return
  }

  return selectedSorter.value({ items: matches })[0]
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

function showPicker() {
  triggerRef.value!.showPicker()
  closeDropdown()
}
const dropdownItems = computed(() =>
  isPaged(items)
    ? new WrappedList(items, () => sortedItems.value)
    : sortedItems.value
)
</script>

<template>
  <div ref="triggerAnchorRef">
    <PopoverRoot v-model:open="isOpen">
      <FormDropdownInput
        ref="triggerRef"
        :input-id
        :files
        :is-open
        :placeholder="placeholderText"
        :selected-items="pagedItems(items).filter(internalIsSelected)"
        :max-selectable
        :uploadable
        :disabled
        :accept
        :is-uploading
        @select-click="toggleDropdown"
        @file-change="handleFileChange"
      >
        <template #anchor="{ element }">
          <PopoverAnchor as="template" :reference="element" />
        </template>
      </FormDropdownInput>
      <PopoverContent
        align="end"
        :align-offset
        update-position-strategy="always"
        :side-offset="12"
        hide-when-detached
        :class="DROPDOWN_PANEL_CLASS"
        :style="
          panelSize && {
            width: `${panelSize.width}px`,
            height: `${panelSize.height}px`
          }
        "
        class="group/dropdown pointer-events-auto relative flex h-160 w-103 flex-col overflow-visible rounded-lg border-none bg-transparent p-0 shadow-lg data-[state=closed]:animate-none data-[state=open]:animate-none"
        @interact-outside.prevent
        @close-auto-focus.prevent="focusTrigger"
      >
        <FormDropdownMenu
          ref="menuRef"
          v-model:filter-selected="filterSelected"
          v-model:layout-mode="layoutMode"
          v-model:sort-selected="sortSelected"
          v-model:search-query="searchQuery"
          v-model:ownership-selected="ownershipSelected"
          v-model:base-model-selected="baseModelSelected"
          v-model:thumbnail-size="thumbnailSize"
          :has-thumbnail-sizes
          :uploadable
          :filter-options
          :sort-options
          :show-ownership-filter
          :ownership-options
          :show-base-model-filter
          :base-model-options
          :disabled
          :items="dropdownItems"
          :candidate-index
          :candidate-label
          :is-selected="internalIsSelected"
          :max-selectable
          @close="closeDropdown"
          @search-enter="handleSearchEnter"
          @item-click="handleSelection"
          @show-picker="showPicker"
        />
        <FormDropdownResizeHandle
          v-for="handle in RESIZE_HANDLES"
          :key="handle"
          v-model:size="panelSize"
          v-model:align-offset="alignOffset"
          :handle
        />
      </PopoverContent>
    </PopoverRoot>
  </div>
</template>
