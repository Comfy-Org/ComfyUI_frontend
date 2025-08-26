<template>
  <div class="relative inline-flex items-center">
    <Button
      v-tooltip.top="{
        value: $t('g.moreOptions'),
        showDelay: 1000
      }"
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

    <!-- Submenus using SubmenuPopover component -->
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
import { computed, ref } from 'vue'

// Import composables
import {
  type MenuOption,
  type SubMenuOption,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'
import { useSubmenuPositioning } from '@/composables/graph/useSubmenuPositioning'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'

// Import components
import MenuOptionItem from './MenuOptionItem.vue'
import SubmenuPopover from './SubmenuPopover.vue'

const popover = ref<InstanceType<typeof Popover>>()
const submenuRefs = ref<Record<string, InstanceType<typeof SubmenuPopover>>>({})
const currentSubmenu = ref<string | null>(null)

// Initialize composables
const { menuOptions, menuOptionsWithSubmenu } = useMoreOptionsMenu()
const { toggleSubmenu, hideAllSubmenus } = useSubmenuPositioning()

// Get minimap styles for consistent background colors
const minimap = useMinimap()
const containerStyles = minimap.containerStyles

// All menu configuration is now in the useMoreOptionsMenu composable

const toggle = (event: Event) => {
  popover.value?.toggle(event)
}

const hide = () => {
  popover.value?.hide()
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

// Function to set submenu refs dynamically
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
</script>
