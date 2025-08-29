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
      severity="secondary"
      @click="toggle"
    >
      <i-lucide:more-vertical :size="16" />
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
import { computed, inject, ref, watch } from 'vue'

import {
  type MenuOption,
  type SubMenuOption,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import { useSubmenuPositioning } from '@/composables/graph/useSubmenuPositioning'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { SelectionOverlayInjectionKey } from '@/types/selectionOverlayTypes'

import MenuOptionItem from './MenuOptionItem.vue'
import SubmenuPopover from './SubmenuPopover.vue'

const popover = ref<InstanceType<typeof Popover>>()
const buttonRef = ref<InstanceType<typeof Button> | HTMLElement | null>(null)
// Track open state ourselves so we can restore after drag/move
const isOpen = ref(false)
const wasOpenBeforeHide = ref(false)
const submenuRefs = ref<Record<string, InstanceType<typeof SubmenuPopover>>>({})
const currentSubmenu = ref<string | null>(null)

const { menuOptions, menuOptionsWithSubmenu } = useMoreOptionsMenu()
const { toggleSubmenu, hideAllSubmenus } = useSubmenuPositioning()

const minimap = useMinimap()
const containerStyles = minimap.containerStyles

const toggle = (event: Event) => {
  if (isOpen.value) {
    hide()
  } else {
    popover.value?.show(event)
    isOpen.value = true
  }
}

const hide = () => {
  popover.value?.hide()
  isOpen.value = false
  hideAll()
}

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
  hide()
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

// When selection is dragged the overlay (and toolbox) hide; ensure the popover
// hides too so it doesn't float detached, and restore it after movement.
const selectionOverlayState = inject(SelectionOverlayInjectionKey)
watch(
  () => selectionOverlayState?.updateCount.value,
  () => {
    if (!selectionOverlayState) return
    const visible = selectionOverlayState.visible.value
    if (!visible) {
      if (isOpen.value) {
        wasOpenBeforeHide.value = true
        hide()
      }
    } else if (wasOpenBeforeHide.value) {
      // Overlay visible again after move; reopen popover anchored to button.
      wasOpenBeforeHide.value = false
      const targetEl = (buttonRef.value as any)?.$el || buttonRef.value
      if (targetEl instanceof HTMLElement) {
        popover.value?.show(new Event('reopen'), targetEl)
        isOpen.value = true
      }
    }
  }
)
</script>
