<template>
  <div class="relative inline-flex items-center">
    <Button
      ref="buttonRef"
      v-tooltip.top="{
        value: $t('g.moreOptions'),
        showDelay: 1000
      }"
      data-testid="more-options-button"
      text
      class="h-8 w-8 px-0"
      severity="secondary"
      @click="toggle"
    >
      <i-lucide:more-vertical class="w-4 h-4" />
    </Button>

    <Popover
      ref="popover"
      :append-to="'body'"
      :auto-z-index="true"
      :base-z-index="1000"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="pt"
      @hide="onPopoverHide"
    >
      <div class="flex flex-col p-2 min-w-48">
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
      :container-styles="containerStyles"
      @submenu-click="handleSubmenuClick"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, onMounted, ref, watch } from 'vue'

import {
  forceCloseMoreOptionsSignal,
  moreOptionsOpen,
  moreOptionsRestorePending,
  restoreMoreOptionsSignal
} from '@/composables/canvas/useSelectionToolboxPosition'
import {
  type MenuOption,
  type SubMenuOption,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import { useSubmenuPositioning } from '@/composables/graph/useSubmenuPositioning'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'

import MenuOptionItem from './MenuOptionItem.vue'
import SubmenuPopover from './SubmenuPopover.vue'

const popover = ref<InstanceType<typeof Popover>>()
const buttonRef = ref<InstanceType<typeof Button> | HTMLElement | null>(null)
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

const minimap = useMinimap()
const containerStyles = minimap.containerStyles

function getButtonEl(): HTMLElement | null {
  const el = (buttonRef.value as any)?.$el || buttonRef.value
  return el instanceof HTMLElement ? el : null
}

function openPopover(triggerEvent?: Event): boolean {
  const el = getButtonEl()
  if (!el || !el.isConnected) return false
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
  if (openPopover(new Event('reopen'))) {
    wasOpenBeforeHide.value = false
    restoreAttempts = 0
    return
  }
  // Defer with limited retries (layout / mount race)
  if (restoreAttempts >= 5) return
  restoreAttempts++
  requestAnimationFrame(() => attemptRestore())
}

const toggle = (event: Event) => {
  if (isOpen.value) closePopover('manual')
  else openPopover(event)
}

const hide = (reason: HideReason = 'manual') => closePopover(reason)

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
    class: 'absolute z-50'
  },
  content: {
    class: [
      'mt-2 text-neutral dark-theme:text-white rounded-lg',
      'shadow-lg border border-zinc-200 dark-theme:border-zinc-700'
    ],
    style: {
      backgroundColor: containerStyles.value.backgroundColor
    }
  }
}))

// Distinguish outside click (PrimeVue dismiss) from programmatic hides.
const onPopoverHide = () => {
  if (lastProgrammaticHideReason.value == null) {
    isOpen.value = false
    hideAll()
    wasOpenBeforeHide.value = false
    moreOptionsOpen.value = false
    // Outside (natural) hide: ensure restore is cancelled
    moreOptionsRestorePending.value = false
  }
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
  if (moreOptionsRestorePending.value && !isOpen.value) {
    requestAnimationFrame(() => attemptRestore())
  }
})
</script>
