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
            role="button"
            class="flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer"
            @click="handleOptionClick(option)"
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
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { type Component, computed, markRaw, ref } from 'vue'
import ILucideFolderPlus from '~icons/lucide/folder-plus'
import ILucideInfo from '~icons/lucide/info'
import ILucideMinimize2 from '~icons/lucide/minimize-2'
import ILucideMoveDiagonal2 from '~icons/lucide/move-diagonal-2'
import ILucideShrink from '~icons/lucide/shrink'
import ILucideExpand from '~icons/lucide/expand'
import ILucidePalette from '~icons/lucide/palette'
import ILucidePin from '~icons/lucide/pin'
import ILucidePlay from '~icons/lucide/play'
import ILucideSettings from '~icons/lucide/settings'
import ILucideBox from '~icons/lucide/box'
import ILucideBan from '~icons/lucide/ban'
import ILucideTrash2 from '~icons/lucide/trash-2'

const popover = ref<InstanceType<typeof Popover>>()

interface MenuOption {
  label?: string
  icon?: Component
  shortcut?: string
  hasSubmenu?: boolean
  type?: 'divider'
  action?: () => void
}

const menuOptions: MenuOption[] = [
  {
    label: 'Rename',
    action: () => console.log('Rename action')
  },
  {
    label: 'Copy',
    shortcut: 'Ctrl+C',
    action: () => console.log('Copy action')
  },
  {
    label: 'Duplicate',
    shortcut: 'Ctrl+D',
    action: () => console.log('Duplicate action')
  },
  {
    type: 'divider'
  },
  {
    label: 'Node Info',
    icon: markRaw(ILucideInfo),
    action: () => console.log('Node Info action')
  },
  {
    label: 'Adjust Size',
    icon: markRaw(ILucideMoveDiagonal2),
    action: () => console.log('Adjust Size action')
  },
  {
    label: 'Minimize Node',
    icon: markRaw(ILucideMinimize2),
    action: () => console.log('Minimize Node action')
  },
  {
    label: 'Shape',
    icon: markRaw(ILucideBox),
    hasSubmenu: true,
    action: () => console.log('Shape submenu')
  },
  {
    label: 'Color',
    icon: markRaw(ILucidePalette),
    hasSubmenu: true,
    action: () => console.log('Color submenu')
  },
  {
    type: 'divider'
  },
  {
    label: 'Add Subgraph to Library',
    icon: markRaw(ILucideFolderPlus),
    action: () => console.log('Add Subgraph to Library action')
  },
  {
    label: 'Unpack Subgraph',
    icon: markRaw(ILucideExpand),
    action: () => console.log('Unpack Subgraph action')
  },
  {
    label: 'Convert to Subgraph',
    icon: markRaw(ILucideShrink),
    action: () => console.log('Convert to Subgraph action')
  },
  {
    type: 'divider'
  },
  {
    label: 'Pin',
    icon: markRaw(ILucidePin),
    action: () => console.log('Pin action')
  },
  {
    label: 'Bypass',
    icon: markRaw(ILucideBan),
    shortcut: 'Ctrl+B',
    action: () => console.log('Bypass action')
  },
  {
    label: 'Run Branch',
    icon: markRaw(ILucidePlay),
    action: () => console.log('Run Branch action')
  },
  {
    type: 'divider'
  },
  {
    label: 'Delete',
    icon: markRaw(ILucideTrash2),
    shortcut: 'Delete',
    action: () => console.log('Delete action')
  }
]

const toggle = (event: Event) => {
  popover.value?.toggle(event)
}

const hide = () => {
  popover.value?.hide()
}

const handleOptionClick = (option: MenuOption) => {
  if (option.action) {
    option.action()
    hide()
  }
}

const pt = computed(() => ({
  root: {
    class: 'absolute z-50'
  },
  content: {
    class: [
      'mt-2 bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white rounded-lg',
      'shadow-lg border border-zinc-200 dark-theme:border-zinc-700'
    ]
  }
}))
</script>
