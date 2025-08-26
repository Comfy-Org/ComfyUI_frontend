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
        <template v-for="option in menuOptions" :key="option.label">
          <div
            v-if="option.type === 'divider'"
            class="h-px bg-gray-200 dark-theme:bg-zinc-700 my-1"
          />
          <div
            v-else
            :ref="
              option.hasSubmenu ? `submenu-trigger-${option.label}` : undefined
            "
            role="button"
            class="flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer"
            @click="handleOptionClick(option, $event)"
            @mouseenter="handleMouseEnter(option, $event)"
            @mouseleave="handleMouseLeave(option)"
          >
            <component :is="option.icon" v-if="option.icon" :size="16" />
            <span class="flex-1">{{ option.label }}</span>
            <span v-if="option.shortcut" class="text-xs opacity-60">
              {{ option.shortcut }}
            </span>
            <i-lucide:chevron-right
              v-if="option.hasSubmenu"
              :size="14"
              class="opacity-60"
            />
          </div>
        </template>
      </div>
    </Popover>

    <!-- Submenus using PrimeVue Popover -->
    <Popover
      v-for="option in menuOptionsWithSubmenu"
      :key="`submenu-${option.label}`"
      :ref="`submenu-${option.label}`"
      :append-to="'body'"
      :auto-z-index="true"
      :base-z-index="1100"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="submenuPt"
      @mouseenter="keepSubmenuOpen"
      @mouseleave="handleSubmenuLeave(option)"
    >
      <div class="flex flex-col p-2 min-w-40">
        <div
          v-for="subOption in option.submenu"
          :key="subOption.label"
          class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer"
          @click="handleSubmenuClick(subOption)"
        >
          <component :is="subOption.icon" v-if="subOption.icon" :size="16" />
          <div
            v-else-if="subOption.color"
            class="w-4 h-4 rounded-full border border-gray-300 dark-theme:border-zinc-600"
            :style="{ backgroundColor: subOption.color }"
          />
          <span>{{ subOption.label }}</span>
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import {
  type Component,
  computed,
  getCurrentInstance,
  markRaw,
  nextTick,
  onMounted,
  ref
} from 'vue'
// Import icons
import ILucideBan from '~icons/lucide/ban'
import ILucideBox from '~icons/lucide/box'
import ILucideCircle from '~icons/lucide/circle'
import ILucideCopy from '~icons/lucide/copy'
import ILucideCopyPlus from '~icons/lucide/copy-plus'
import ILucideEdit2 from '~icons/lucide/edit-2'
import ILucideExpand from '~icons/lucide/expand'
import ILucideFolderPlus from '~icons/lucide/folder-plus'
import ILucideHexagon from '~icons/lucide/hexagon'
import ILucideInfo from '~icons/lucide/info'
import ILucideMaximize2 from '~icons/lucide/maximize-2'
import ILucideMinimize2 from '~icons/lucide/minimize-2'
import ILucideMoveDiagonal2 from '~icons/lucide/move-diagonal-2'
import ILucidePalette from '~icons/lucide/palette'
import ILucidePin from '~icons/lucide/pin'
import ILucidePinOff from '~icons/lucide/pin-off'
import ILucidePlay from '~icons/lucide/play'
import ILucideShrink from '~icons/lucide/shrink'
import ILucideSquare from '~icons/lucide/square'
import ILucideTrash2 from '~icons/lucide/trash-2'
import ILucideTriangle from '~icons/lucide/triangle'
import ILucideZapOff from '~icons/lucide/zap-off'

// Import composables
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'
import { useNodeInfo } from '@/composables/graph/useNodeInfo'
import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { useSubgraphOperations } from '@/composables/graph/useSubgraphOperations'
import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import {
  LGraphEventMode,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const popover = ref<InstanceType<typeof Popover>>()
const submenuRefs = ref<Record<string, InstanceType<typeof Popover>>>({})
let hoverTimeout: ReturnType<typeof setTimeout> | null = null
let currentSubmenu: string | null = null

// Initialize composables
const canvasStore = useCanvasStore()
const { copySelection, duplicateSelection, deleteSelection, renameSelection } =
  useSelectionOperations()

const { colorOptions, shapeOptions, applyColor, applyShape } =
  useNodeCustomization()

const {
  convertToSubgraph,
  unpackSubgraph,
  addSubgraphToLibrary,
  isSubgraphSelected
} = useSubgraphOperations()

const {
  showNodeInfo,
  adjustNodeSize,
  toggleNodeCollapse,
  toggleNodePin,
  toggleNodeBypass,
  runBranch
} = useNodeInfo()

// Get minimap styles for consistent background colors
const minimap = useMinimap()
const containerStyles = minimap.containerStyles

// Info button functionality (same as InfoButton.vue)
const nodeDefStore = useNodeDefStore()
const sidebarTabStore = useSidebarTabStore()
const nodeHelpStore = useNodeHelpStore()
const { id: nodeLibraryTabId } = useNodeLibrarySidebarTab()

const nodeDef = computed(() => {
  if (canvasStore.selectedItems.length !== 1) return null
  const item = canvasStore.selectedItems[0]
  if (!isLGraphNode(item)) return null
  return nodeDefStore.fromLGraphNode(item)
})

const showNodeHelp = () => {
  const def = nodeDef.value
  if (!def) return
  if (sidebarTabStore.activeSidebarTabId !== nodeLibraryTabId) {
    sidebarTabStore.toggleSidebarTab(nodeLibraryTabId)
  }
  nodeHelpStore.openHelp(def)
}

// Computed properties to check current state of selected items
const selectedNodes = computed(() => {
  return canvasStore.selectedItems.filter((item) =>
    isLGraphNode(item)
  ) as LGraphNode[]
})

const hasSubgraphs = computed(() => {
  return canvasStore.selectedItems.some((item) => item instanceof SubgraphNode)
})

const selectedNodesStates = computed(() => {
  const nodes = selectedNodes.value
  if (nodes.length === 0)
    return { collapsed: false, pinned: false, bypassed: false }

  const collapsed = nodes.some((node) => node.flags?.collapsed)
  const pinned = nodes.some((node) => node.pinned)
  const bypassed = nodes.some((node) => node.mode === LGraphEventMode.BYPASS)

  return { collapsed, pinned, bypassed }
})

interface MenuOption {
  label?: string
  icon?: Component
  shortcut?: string
  hasSubmenu?: boolean
  type?: 'divider'
  action?: () => void
  submenu?: SubMenuOption[]
}

interface SubMenuOption {
  label: string
  icon?: Component
  action: () => void
  color?: string
}

// Create shape submenu options
const shapeSubmenu: SubMenuOption[] = shapeOptions.map((shape) => ({
  label: shape.localizedName,
  icon: markRaw(
    shape.name === 'box'
      ? ILucideSquare
      : shape.name === 'round'
        ? ILucideCircle
        : shape.name === 'card'
          ? ILucideBox
          : shape.name === 'circle'
            ? ILucideCircle
            : shape.name === 'arrow'
              ? ILucideTriangle
              : ILucideHexagon
  ),
  action: () => applyShape(shape)
}))

// Create color submenu options
const colorSubmenu: SubMenuOption[] = colorOptions.map((color) => ({
  label: color.localizedName,
  color: color.value.light, // Use light color for display
  action: () => applyColor(color)
}))

const menuOptions = computed((): MenuOption[] => {
  const states = selectedNodesStates.value
  const hasSubgraphsSelected = hasSubgraphs.value

  const baseOptions: MenuOption[] = [
    {
      label: 'Rename',
      icon: markRaw(ILucideEdit2),
      action: renameSelection
    },
    {
      type: 'divider'
    },
    {
      label: 'Copy',
      icon: markRaw(ILucideCopy),
      shortcut: 'Ctrl+C',
      action: copySelection
    },
    {
      label: 'Duplicate',
      icon: markRaw(ILucideCopyPlus),
      shortcut: 'Ctrl+D',
      action: duplicateSelection
    },
    {
      type: 'divider'
    },
    {
      label: 'Node Info',
      icon: markRaw(ILucideInfo),
      action: showNodeHelp
    },
    {
      label: 'Adjust Size',
      icon: markRaw(ILucideMoveDiagonal2),
      action: adjustNodeSize
    },
    // Show appropriate collapse/expand option based on current state
    {
      label: states.collapsed ? 'Expand Node' : 'Minimize Node',
      icon: markRaw(states.collapsed ? ILucideMaximize2 : ILucideMinimize2),
      action: toggleNodeCollapse
    },
    {
      type: 'divider'
    },
    {
      label: 'Shape',
      icon: markRaw(ILucideBox),
      hasSubmenu: true,
      submenu: shapeSubmenu,
      action: () => {} // No-op for submenu items
    },
    {
      label: 'Color',
      icon: markRaw(ILucidePalette),
      hasSubmenu: true,
      submenu: colorSubmenu,
      action: () => {} // No-op for submenu items
    },
    {
      type: 'divider'
    },
    {
      label: 'Add Subgraph to Library',
      icon: markRaw(ILucideFolderPlus),
      action: addSubgraphToLibrary
    }
  ]

  // Add appropriate subgraph option based on selection
  if (hasSubgraphsSelected) {
    baseOptions.push({
      label: 'Unpack Subgraph',
      icon: markRaw(ILucideExpand),
      action: unpackSubgraph
    })
  } else {
    baseOptions.push({
      label: 'Convert to Subgraph',
      icon: markRaw(ILucideShrink),
      action: convertToSubgraph
    })
  }

  // Add remaining options
  baseOptions.push(
    {
      type: 'divider'
    },
    // Show appropriate pin option based on current state
    {
      label: states.pinned ? 'Unpin' : 'Pin',
      icon: markRaw(states.pinned ? ILucidePinOff : ILucidePin),
      action: toggleNodePin
    },
    {
      type: 'divider'
    },
    // Show appropriate bypass option based on current state
    {
      label: states.bypassed ? 'Remove Bypass' : 'Bypass',
      icon: markRaw(states.bypassed ? ILucideZapOff : ILucideBan),
      shortcut: 'Ctrl+B',
      action: toggleNodeBypass
    },
    {
      label: 'Run Branch',
      icon: markRaw(ILucidePlay),
      action: runBranch
    },
    {
      type: 'divider'
    },
    {
      label: 'Delete',
      icon: markRaw(ILucideTrash2),
      shortcut: 'Delete',
      action: deleteSelection
    }
  )

  return baseOptions
})

// Computed property to get only menu items with submenus
const menuOptionsWithSubmenu = computed(() =>
  menuOptions.value.filter((option) => option.hasSubmenu && option.submenu)
)

const toggle = (event: Event) => {
  popover.value?.toggle(event)
}

const hide = () => {
  popover.value?.hide()
  hideAllSubmenus()
}

const hideAllSubmenus = () => {
  menuOptionsWithSubmenu.value.forEach((option) => {
    const submenu = submenuRefs.value[`submenu-${option.label}`]
    if (submenu) {
      submenu.hide()
    }
  })
  currentSubmenu = null
}

const handleOptionClick = (option: MenuOption, event: Event) => {
  if (!option.hasSubmenu && option.action) {
    option.action()
    hide()
  } else if (option.hasSubmenu) {
    event.stopPropagation()
    void showSubmenu(option, event)
  }
}

const showSubmenu = async (option: MenuOption, event: Event) => {
  if (!option.label || !option.hasSubmenu) return

  // Hide other submenus
  menuOptionsWithSubmenu.value.forEach((opt) => {
    if (opt.label !== option.label) {
      const submenu = submenuRefs.value[`submenu-${opt.label}`]
      if (submenu) {
        submenu.hide()
      }
    }
  })

  currentSubmenu = option.label

  await nextTick()
  const submenu = submenuRefs.value[`submenu-${option.label}`]
  if (submenu) {
    const target = event.currentTarget as HTMLElement

    // Position submenu to the right of the menu item
    const rect = target.getBoundingClientRect()
    const fakeEvent = {
      ...event,
      clientX: rect.right + 5, // Position 5px to the right of the menu item
      clientY: rect.top, // Align with the top of the menu item
      currentTarget: target,
      target: target
    } as Event

    submenu.show(fakeEvent, target)
  }
}

const handleSubmenuClick = (subOption: SubMenuOption) => {
  subOption.action()
  hide()
}

const handleMouseEnter = (option: MenuOption, event: Event) => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }

  if (option.hasSubmenu) {
    void showSubmenu(option, event)
  } else if (currentSubmenu) {
    // Hide submenu if hovering over non-submenu item
    hideAllSubmenus()
  }
}

const handleMouseLeave = (option: MenuOption) => {
  if (option.hasSubmenu && option.label) {
    hoverTimeout = setTimeout(() => {
      if (currentSubmenu === option.label) {
        const submenu = submenuRefs.value[`submenu-${option.label}`]
        if (submenu) {
          submenu.hide()
        }
        currentSubmenu = null
      }
    }, 200)
  }
}

const keepSubmenuOpen = () => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
}

const handleSubmenuLeave = (option: MenuOption) => {
  if (option.label) {
    hoverTimeout = setTimeout(() => {
      if (currentSubmenu === option.label) {
        const submenu = submenuRefs.value[`submenu-${option.label}`]
        if (submenu) {
          submenu.hide()
        }
        currentSubmenu = null
      }
    }, 200)
  }
}

// Set up submenu refs on mount
onMounted(() => {
  const instance = getCurrentInstance()
  if (!instance) return

  menuOptionsWithSubmenu.value.forEach((option) => {
    if (option.label) {
      const submenuRef = instance.refs[`submenu-${option.label}`] as
        | InstanceType<typeof Popover>
        | InstanceType<typeof Popover>[]
      if (Array.isArray(submenuRef) && submenuRef[0]) {
        submenuRefs.value[`submenu-${option.label}`] = submenuRef[0]
      } else if (submenuRef && !Array.isArray(submenuRef)) {
        submenuRefs.value[`submenu-${option.label}`] = submenuRef
      }
    }
  })
})

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

const submenuPt = computed(() => ({
  root: {
    class: 'absolute z-[60]'
  },
  content: {
    class: [
      'text-neutral dark-theme:text-white rounded-lg',
      'shadow-lg border border-zinc-200 dark-theme:border-zinc-700'
    ],
    style: {
      backgroundColor: containerStyles.value.backgroundColor
    }
  }
}))
</script>
