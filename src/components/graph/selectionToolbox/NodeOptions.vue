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
      :pt="pt"
      @show="onPopoverShow"
      @hide="onPopoverHide"
      @wheel="canvasInteractions.forwardEventToCanvas"
    >
      <div class="flex min-w-48 flex-col p-2">
        <MenuOptionItem
          v-for="(option, index) in menuOptions"
          :key="option.label || `divider-${index}`"
          :option="option"
          @click="handleOptionClick"
        />
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
import { useRafFn } from '@vueuse/core'
import Popover from 'primevue/popover'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

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
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'

import MenuOptionItem from './MenuOptionItem.vue'
import SubmenuPopover from './SubmenuPopover.vue'

const popover = ref<InstanceType<typeof Popover>>()
const targetElement = ref<HTMLElement | null>(null)
const isTriggeredByToolbox = ref<boolean>(true)
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
const canvasInteractions = useCanvasInteractions()

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
  const marginY = 8 // tailwind mt-2 ~ 0.5rem = 8px
  const left = isTriggeredByToolbox.value
    ? rect.left + rect.width / 2
    : rect.right - rect.width / 4
  const top = isTriggeredByToolbox.value
    ? rect.bottom + marginY
    : rect.top - marginY - 6
  try {
    overlayEl.style.position = 'fixed'
    overlayEl.style.left = `${left}px`
    overlayEl.style.top = `${top}px`
    overlayEl.style.transform = 'translate(-50%, 0)'
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
  if (!el || !el.isConnected) return false
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
  if (isOpen.value) closePopover('manual')
  else openPopover(event, element, clickedFromToolbox)
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

const pt = computed(() => ({
  root: {
    class: 'absolute z-50 w-[300px] px-[12]'
  },
  content: {
    class: [
      'mt-2 text-neutral dark-theme:text-white rounded-lg',
      'shadow-lg border border-zinc-200 dark-theme:border-zinc-700',
      'bg-interface-panel-surface'
    ]
  }
}))

// Distinguish outside click (PrimeVue dismiss) from programmatic hides.
const onPopoverShow = () => {
  overlayElCache = resolveOverlayEl()
  // Delay first reposition slightly to ensure DOM fully painted
  requestAnimationFrame(() => repositionPopover())
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
