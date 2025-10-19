<template>
  <div
    class="comfy-menu-button-wrapper flex shrink-0 cursor-pointer flex-col items-center justify-center rounded-t-md p-2 transition-colors"
    :class="{
      'comfy-menu-button-active': menuRef?.visible
    }"
    @click="menuRef?.toggle($event)"
  >
    <ComfyLogoTransparent
      alt="ComfyUI Logo"
      class="comfyui-logo h-[18px] w-[18px]"
    />

    <span
      v-if="!isSmall"
      class="side-bar-button-label mt-1 text-center text-[10px]"
      >{{ t('sideToolbar.labels.menu') }}</span
    >
  </div>

  <TieredMenu
    ref="menuRef"
    :model="translatedItems"
    :popup="true"
    class="comfy-command-menu"
    @show="onMenuShow"
  >
    <template #item="{ item, props }">
      <a
        class="p-menubar-item-link px-4 py-2"
        v-bind="props.action"
        :href="item.url"
        target="_blank"
        :class="typeof item.class === 'function' ? item.class() : item.class"
        @mousedown="
          isZoomCommand(item) ? handleZoomMouseDown(item, $event) : undefined
        "
        @click="handleItemClick(item, $event)"
      >
        <i
          v-if="hasActiveStateSiblings(item)"
          class="p-menubar-item-icon pi pi-check text-sm"
          :class="{ invisible: !item.comfyCommand?.active?.() }"
        />
        <span
          v-else-if="
            item.icon && item.comfyCommand?.id !== 'Comfy.NewBlankWorkflow'
          "
          class="p-menubar-item-icon text-sm"
          :class="item.icon"
        />
        <span class="p-menubar-item-label text-nowrap">{{ item.label }}</span>
        <i
          v-if="item.comfyCommand?.id === 'Comfy.NewBlankWorkflow'"
          class="ml-auto"
          :class="item.icon"
        />
        <span
          v-if="item?.comfyCommand?.keybinding"
          class="keybinding-tag ml-auto rounded border border-surface p-1 text-xs text-nowrap text-muted"
        >
          {{ item.comfyCommand.keybinding.combo.toString() }}
        </span>
        <i v-if="item.items" class="pi pi-angle-right ml-auto" />
      </a>
    </template>
  </TieredMenu>
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import TieredMenu from 'primevue/tieredmenu'
import type { TieredMenuMethods, TieredMenuState } from 'primevue/tieredmenu'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import ComfyLogoTransparent from '@/components/icons/ComfyLogoTransparent.vue'
import SettingDialogContent from '@/platform/settings/components/SettingDialogContent.vue'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { whileMouseDown } from '@/utils/mouseDownUtil'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const { t } = useI18n()
const commandStore = useCommandStore()
const menuItemStore = useMenuItemStore()
const colorPaletteStore = useColorPaletteStore()
const colorPaletteService = useColorPaletteService()
const dialogStore = useDialogStore()
const managerState = useManagerState()

const { isSmall = false } = defineProps<{
  isSmall?: boolean
}>()

const menuRef = ref<
  ({ dirty: boolean } & TieredMenuMethods & TieredMenuState) | null
>(null)

const translateMenuItem = (item: MenuItem): MenuItem => {
  const label = typeof item.label === 'function' ? item.label() : item.label
  const translatedLabel = label
    ? t(`menuLabels.${normalizeI18nKey(label)}`, label)
    : undefined

  return {
    ...item,
    label: translatedLabel,
    items: item.items?.map(translateMenuItem)
  }
}

const showSettings = (defaultPanel?: string) => {
  dialogStore.showDialog({
    key: 'global-settings',
    headerComponent: SettingDialogHeader,
    component: SettingDialogContent,
    props: {
      defaultPanel
    }
  })
}

const showManageExtensions = async () => {
  await managerState.openManager({
    initialTab: ManagerTab.All,
    showToastOnLegacyError: false
  })
}

const themeMenuItems = computed(() => {
  return colorPaletteStore.palettes.map((palette) => ({
    key: `theme-${palette.id}`,
    label: palette.name,
    parentPath: 'theme',
    comfyCommand: {
      active: () => colorPaletteStore.activePaletteId === palette.id
    },
    command: async () => {
      await colorPaletteService.loadColorPalette(palette.id)
    }
  }))
})

const extraMenuItems = computed(() => [
  { separator: true },
  {
    key: 'theme',
    label: t('menu.theme'),
    items: themeMenuItems.value
  },
  { separator: true },
  {
    key: 'browse-templates',
    label: t('menuLabels.Browse Templates'),
    icon: 'icon-[comfy--template]',
    command: () => commandStore.execute('Comfy.BrowseTemplates')
  },
  {
    key: 'settings',
    label: t('g.settings'),
    icon: 'mdi mdi-cog-outline',
    command: () => showSettings()
  },
  {
    key: 'manage-extensions',
    label: t('menu.manageExtensions'),
    icon: 'mdi mdi-puzzle-outline',
    command: showManageExtensions
  }
])

const translatedItems = computed(() => {
  const items = menuItemStore.menuItems.map(translateMenuItem)
  let helpIndex = items.findIndex((item) => item.key === 'Help')
  let helpItem: MenuItem | undefined

  if (helpIndex !== -1) {
    items[helpIndex].icon = 'mdi mdi-help-circle-outline'
    // If help is not the last item (i.e. we have extension commands), separate them
    const isLastItem = helpIndex !== items.length - 1
    helpItem = items.splice(
      helpIndex,
      1,
      ...(isLastItem
        ? [
            {
              separator: true
            }
          ]
        : [])
    )[0]
  }
  helpIndex = items.length

  items.splice(
    helpIndex,
    0,
    ...extraMenuItems.value,
    ...(helpItem
      ? [
          {
            separator: true
          },
          helpItem
        ]
      : [])
  )

  return items
})

const onMenuShow = () => {
  void nextTick(() => {
    // Force the menu to show submenus on hover
    if (menuRef.value) {
      menuRef.value.dirty = true
    }
  })
}

const isZoomCommand = (item: MenuItem) => {
  return (
    item.comfyCommand?.id === 'Comfy.Canvas.ZoomIn' ||
    item.comfyCommand?.id === 'Comfy.Canvas.ZoomOut'
  )
}

const handleZoomMouseDown = (item: MenuItem, event: MouseEvent) => {
  if (item.comfyCommand) {
    whileMouseDown(
      event,
      async () => {
        await commandStore.execute(item.comfyCommand!.id)
      },
      50
    )
  }
}

const handleItemClick = (item: MenuItem, event: MouseEvent) => {
  // Prevent the menu from closing for zoom commands or commands that have active state
  if (isZoomCommand(item) || item.comfyCommand?.active) {
    event.preventDefault()
    event.stopPropagation()
    if (item.comfyCommand?.active) {
      item.command?.({
        item,
        originalEvent: event
      })
    }
    return false
  }
}

const hasActiveStateSiblings = (item: MenuItem): boolean => {
  // Check if this item has siblings with active state (either from store or theme items)
  return (
    item.parentPath &&
    (item.parentPath === 'theme' ||
      menuItemStore.menuItemHasActiveStateChildren[item.parentPath])
  )
}
</script>

<style scoped>
.comfy-menu-button-wrapper {
  width: var(--sidebar-width);
  height: var(--sidebar-item-height);
}

.comfy-menu-button-wrapper:hover {
  background: var(--p-button-text-secondary-hover-background);
}

.comfy-menu-button-active,
.comfy-menu-button-active:hover {
  background-color: var(--content-hover-bg);
}

.keybinding-tag {
  background: var(--p-content-hover-background);
  border-color: var(--p-content-border-color);
  border-style: solid;
}
</style>

<style>
.comfy-command-menu {
  --p-tieredmenu-item-focus-background: color-mix(
    in srgb,
    var(--fg-color) 15%,
    transparent
  );
  --p-tieredmenu-item-active-background: color-mix(
    in srgb,
    var(--fg-color) 10%,
    transparent
  );
}

.comfy-command-menu ul {
  background-color: var(--comfy-menu-bg) !important;
}
</style>
