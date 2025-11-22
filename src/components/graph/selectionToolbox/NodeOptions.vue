<template>
  <div>
    <Popover
      ref="popover"
      :append-to="'body'"
      :auto-z-index="true"
      :base-z-index="1000"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="{
        root: {
          class: 'absolute z-50 w-[300px]'
        },
        content: {
          class: [
            'mt-2 text-base-foreground rounded-lg',
            'shadow-lg border border-border-default',
            'bg-interface-panel-surface'
          ]
        }
      }"
      @show="onPopoverShow"
      @hide="onPopoverHide"
    >
      <div class="flex min-w-48 flex-col p-2">
        <!-- Search input (fixed at top) -->
        <div class="mb-2 px-1">
          <SearchBox
            ref="searchInput"
            v-model="searchQuery"
            :autofocus="false"
            :placeholder="t('contextMenu.Search')"
            class="w-full bg-secondary-background text-text-primary"
            @keydown.escape="clearSearch"
          />
        </div>

        <!-- Menu items (scrollable) -->
        <div class="max-h-96 lg:max-h-[75vh] overflow-y-auto">
          <MenuOptionItem
            v-for="(option, index) in filteredMenuOptions"
            :key="option.label || `divider-${index}`"
            :option="option"
            @click="handleOptionClick"
          />
        </div>

        <!-- empty state for search -->
        <div
          v-if="filteredMenuOptions.length === 0"
          class="px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wide pointer-events-none"
        >
          {{ t('g.noResults') }}
        </div>
      </div>
    </Popover>

    <SubmenuPopover
      v-for="option in menuOptionsWithSubmenu"
      :key="`submenu-${option.label}`"
      :ref="(el) => setSubmenuRef(`submenu-${option.label}`, el)"
      :option="option"
      @submenu-click="handleSubmenuClick"
    />
  </div>
</template>

<script setup lang="ts">
import {
  breakpointsTailwind,
  debouncedRef,
  useBreakpoints,
  useRafFn
} from '@vueuse/core'
import { useFuse } from '@vueuse/integrations/useFuse'
import Popover from 'primevue/popover'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/input/SearchBox.vue'
import {
  forceCloseMoreOptionsSignal,
  moreOptionsOpen,
  moreOptionsRestorePending,
  restoreMoreOptionsSignal
} from '@/composables/canvas/useSelectionToolboxPosition'
import {
  registerNodeOptionsInstance,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import type {
  MenuOption,
  SubMenuOption
} from '@/composables/graph/useMoreOptionsMenu'
import { useSubmenuPositioning } from '@/composables/graph/useSubmenuPositioning'
import { calculateMenuPosition } from '@/composables/graph/useViewportAwareMenuPositioning'

import MenuOptionItem from './MenuOptionItem.vue'
import SubmenuPopover from './SubmenuPopover.vue'

const { t } = useI18n()

const popover = ref<InstanceType<typeof Popover>>()
const targetElement = ref<HTMLElement | null>(null)
const searchInput = ref<InstanceType<typeof SearchBox> | null>(null)
const searchQuery = ref('')
const debouncedSearchQuery = debouncedRef(searchQuery, 300)
const isTriggeredByToolbox = ref<boolean>(true)
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobileViewport = breakpoints.smaller('md')
// Track open state ourselves so we can restore after drag/move
const isOpen = ref(false)
const wasOpenBeforeHide = ref(false)
// Track why the popover was hidden so we only auto-reopen after drag.
type HideReason = 'manual' | 'drag'
const lastProgrammaticHideReason = ref<HideReason | null>(null)
const submenuRefs = ref<Record<string, InstanceType<typeof SubmenuPopover>>>({})
const currentSubmenu = ref<string | null>(null)

const { menuOptions, menuOptionsWithSubmenu, bump } = useMoreOptionsMenu()
const { toggleSubmenu, hideAllSubmenus } = useSubmenuPositioning()
// const canvasInteractions = useCanvasInteractions()

// Prepare searchable menu options (exclude dividers and categories)
const searchableMenuOptions = computed(() =>
  menuOptions.value.filter(
    (option) => option.type !== 'divider' && option.type !== 'category'
  )
)

// Set up fuzzy search with useFuse
const { results } = useFuse(debouncedSearchQuery, searchableMenuOptions, {
  fuseOptions: {
    keys: ['label'],
    threshold: 0.4
  },
  matchAllWhenSearchEmpty: true
})

// Filter menu options based on fuzzy search results
const filteredMenuOptions = computed(() => {
  const query = debouncedSearchQuery.value.trim()

  if (!query) {
    return menuOptions.value
  }

  // Extract matched items from Fuse results and create a Set of labels for fast lookup
  const matchedItems = results.value.map((result) => result.item)

  // Create a Set of matched labels for O(1) lookup
  const matchedLabels = new Set(matchedItems.map((item) => item.label))

  const filtered: MenuOption[] = []
  let lastWasDivider = false

  // Reconstruct with dividers based on original structure
  for (const option of menuOptions.value) {
    if (option.type === 'divider') {
      lastWasDivider = true
      continue
    }

    if (option.type === 'category') {
      continue
    }

    // Check if this option was matched by fuzzy search (compare by label)
    if (option.label && matchedLabels.has(option.label)) {
      // Add divider before this item if the last item was separated by a divider
      if (lastWasDivider && filtered.length > 0) {
        const lastItem = filtered[filtered.length - 1]
        if (lastItem.type !== 'divider') {
          filtered.push({ type: 'divider' })
        }
      }
      filtered.push(option)
      lastWasDivider = false
    }
  }

  return filtered
})

let lastLogTs = 0
const LOG_INTERVAL = 120 // ms
let overlayElCache: HTMLElement | null = null

function resolveOverlayEl(): HTMLElement | null {
  // Prefer cached element (cleared on hide)
  if (overlayElCache && overlayElCache.isConnected) return overlayElCache
  // PrimeVue Popover root element (component instance $el)
  const direct = (popover.value as any)?.$el
  if (direct instanceof HTMLElement) {
    overlayElCache = direct
    return direct
  }
  // Fallback: try to locate a recent popover root near the button (same z-index class + absolute)
  const btn = targetElement.value
  if (btn) {
    const candidates = Array.from(
      document.querySelectorAll('div.absolute.z-50')
    ) as HTMLElement[]
    // Heuristic: pick the one closest (vertically) below the button
    const rect = btn.getBoundingClientRect()
    let best: { el: HTMLElement; dist: number } | null = null
    for (const el of candidates) {
      const r = el.getBoundingClientRect()
      const dist = Math.abs(r.top - rect.bottom)
      if (!best || dist < best.dist) best = { el, dist }
    }
    if (best && best.el) {
      overlayElCache = best.el
      return best.el
    }
  }
  return null
}

const repositionPopover = () => {
  if (!isOpen.value) return
  const btn = targetElement.value
  const overlayEl = resolveOverlayEl()
  if (!btn || !overlayEl) return

  const rect = btn.getBoundingClientRect()

  try {
    // Calculate viewport-aware position
    const style = calculateMenuPosition({
      triggerRect: rect,
      menuElement: overlayEl,
      isTriggeredByToolbox: isTriggeredByToolbox.value,
      marginY: 8
    })

    // Apply positioning styles
    overlayEl.style.cssText += `; left: ${style.left}; position: ${style.position}; transform: ${style.transform};`

    // Handle top vs bottom positioning
    if (style.top !== undefined) {
      overlayEl.style.top = style.top
      overlayEl.style.bottom = '' // Clear bottom if using top
    } else if (style.bottom !== undefined) {
      overlayEl.style.bottom = style.bottom
      overlayEl.style.top = '' // Clear top if using bottom
    }
  } catch (e) {
    console.warn('[NodeOptions] Failed to set overlay style', e)
    return
  }
  const now = performance.now()
  if (now - lastLogTs > LOG_INTERVAL) {
    lastLogTs = now
  }
}

const { resume: startSync, pause: stopSync } = useRafFn(repositionPopover)

function openPopover(
  triggerEvent?: Event,
  element?: HTMLElement,
  clickedFromToolbox?: boolean
): boolean {
  const el = element || targetElement.value
  if (!el || !el.isConnected) {
    return false
  }
  targetElement.value = el
  if (clickedFromToolbox !== undefined)
    isTriggeredByToolbox.value = clickedFromToolbox
  bump()
  popover.value?.show(triggerEvent ?? new Event('reopen'), el)
  isOpen.value = true
  moreOptionsOpen.value = true
  moreOptionsRestorePending.value = false
  return true
}

function closePopover(reason: HideReason = 'manual') {
  lastProgrammaticHideReason.value = reason
  popover.value?.hide()
  isOpen.value = false
  moreOptionsOpen.value = false
  stopSync()
  hideAll()
  if (reason !== 'drag') {
    wasOpenBeforeHide.value = false
    // Natural hide: cancel any pending restore
    moreOptionsRestorePending.value = false
  } else {
    if (!moreOptionsRestorePending.value) {
      wasOpenBeforeHide.value = true
      moreOptionsRestorePending.value = true
    }
  }
}

let restoreAttempts = 0
function attemptRestore() {
  if (isOpen.value) return
  if (!wasOpenBeforeHide.value && !moreOptionsRestorePending.value) return
  // Try immediately
  if (openPopover(new Event('reopen'), targetElement.value || undefined)) {
    wasOpenBeforeHide.value = false
    restoreAttempts = 0
    return
  }
  // Defer with limited retries (layout / mount race)
  if (restoreAttempts >= 5) return
  restoreAttempts++
  requestAnimationFrame(() => attemptRestore())
}

const toggle = (
  event: Event,
  element?: HTMLElement,
  clickedFromToolbox?: boolean
) => {
  const targetEl = element || targetElement.value

  if (isOpen.value) {
    // If clicking on a different element while open, switch to it
    if (targetEl && targetEl !== targetElement.value) {
      // Update target and reposition, don't close and reopen
      targetElement.value = targetEl
      if (clickedFromToolbox !== undefined)
        isTriggeredByToolbox.value = clickedFromToolbox
      bump()
      // Clear and refocus search for new context
      searchQuery.value = ''
      requestAnimationFrame(() => {
        repositionPopover()
        if (!isMobileViewport.value) {
          searchInput.value?.focusInput()
        }
      })
    } else {
      closePopover('manual')
    }
  } else {
    openPopover(event, element, clickedFromToolbox)
  }
}

const hide = (reason: HideReason = 'manual') => closePopover(reason)

// Export functions for external triggering
defineExpose({
  toggle,
  hide,
  isOpen
})

const hideAll = () => {
  hideAllSubmenus(
    menuOptionsWithSubmenu.value,
    submenuRefs.value,
    currentSubmenu
  )
}

const handleOptionClick = (option: MenuOption, event: Event) => {
  if (!option.hasSubmenu && option.action) {
    option.action()
    hide()
  } else if (option.hasSubmenu) {
    event.stopPropagation()
    const submenuKey = `submenu-${option.label}`
    const submenu = submenuRefs.value[submenuKey]

    if (submenu) {
      void toggleSubmenu(
        option,
        event,
        submenu,
        currentSubmenu,
        menuOptionsWithSubmenu.value,
        submenuRefs.value
      )
    }
  }
}

const handleSubmenuClick = (subOption: SubMenuOption) => {
  subOption.action()
  hide('manual')
}

const setSubmenuRef = (key: string, el: any) => {
  if (el) {
    submenuRefs.value[key] = el
  } else {
    delete submenuRefs.value[key]
  }
}

const clearSearch = () => {
  searchQuery.value = ''
}

// Distinguish outside click (PrimeVue dismiss) from programmatic hides.
const onPopoverShow = () => {
  overlayElCache = resolveOverlayEl()
  // Clear search and focus input
  searchQuery.value = ''
  // Delay first reposition slightly to ensure DOM fully painted
  requestAnimationFrame(() => {
    repositionPopover()
    // Focus the search input after popover is shown
    if (!isMobileViewport.value) {
      searchInput.value?.focusInput()
    }
  })
  startSync()
}

const onPopoverHide = () => {
  if (lastProgrammaticHideReason.value == null) {
    isOpen.value = false
    hideAll()
    wasOpenBeforeHide.value = false
    moreOptionsOpen.value = false
    moreOptionsRestorePending.value = false
  }
  // Clear search when hiding
  searchQuery.value = ''
  overlayElCache = null
  stopSync()
  lastProgrammaticHideReason.value = null
}

// Watch for forced close (drag start)
watch(
  () => forceCloseMoreOptionsSignal.value,
  () => {
    if (isOpen.value) hide('drag')
    else
      wasOpenBeforeHide.value =
        wasOpenBeforeHide.value || moreOptionsRestorePending.value
  }
)

watch(
  () => restoreMoreOptionsSignal.value,
  () => attemptRestore()
)

onMounted(() => {
  // Register this instance globally
  registerNodeOptionsInstance({
    toggle,
    hide,
    isOpen
  })

  if (moreOptionsRestorePending.value && !isOpen.value) {
    requestAnimationFrame(() => attemptRestore())
  }
})

onUnmounted(() => {
  stopSync()
  // Unregister on unmount
  registerNodeOptionsInstance(null)
})
</script>
