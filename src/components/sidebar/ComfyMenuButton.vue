<template>
  <Menu :items="translatedItems" class="comfy-command-menu">
    <template #trigger="{ open }">
      <button
        v-tooltip="{
          value: t('sideToolbar.labels.menu'),
          showDelay: 300,
          hideDelay: 300
        }"
        data-testid="comfy-menu-button"
        type="button"
        :aria-label="t('sideToolbar.labels.menu')"
        :class="
          cn(
            'flex h-(--sidebar-item-height) w-(--sidebar-width) shrink-0 cursor-pointer flex-col items-center justify-center border-none bg-transparent p-2 transition-colors hover:bg-interface-panel-hover-surface',
            open &&
              'bg-interface-panel-selected-surface hover:bg-interface-panel-selected-surface'
          )
        "
        @click="onLogoMenuClick"
      >
        <div class="grid place-items-center-safe gap-0.5">
          <i
            class="col-span-full row-span-full icon-[lucide--chevron-down] size-3 translate-x-4 text-muted-foreground"
          />
          <ComfyLogo
            alt="ComfyUI Logo"
            class="comfyui-logo col-span-full row-span-full size-4.5"
            mode="fill"
          />
        </div>
      </button>
    </template>
    <template #item="{ item }">
      <a
        v-if="item.key !== 'nodes-2.0-toggle'"
        class="flex w-full items-center gap-2"
        :href="item.url"
        target="_blank"
        :class="toValue(item.class)"
        @mousedown="handleZoomMouseDown(item, $event)"
        @click="handleItemClick(item, $event)"
      >
        <i
          v-if="hasCheckableSiblings(item)"
          data-testid="menu-item-indicator"
          class="icon-[lucide--check] size-4"
          :class="{ invisible: !toValue(item.checked) }"
        />
        <span
          v-else-if="item.icon && !isNewBlankWorkflow(item)"
          class="size-4"
          :class="item.icon"
        />
        <span class="text-nowrap">{{ item.label }}</span>
        <i v-if="isNewBlankWorkflow(item)" class="ml-auto" :class="item.icon" />
        <span
          v-if="toValue(item.shortcut)"
          class="ml-auto rounded-sm border border-border-default bg-secondary-background p-1 text-xs text-nowrap text-muted"
        >
          {{ toValue(item.shortcut) }}
        </span>
        <i
          v-if="item.items"
          class="ml-auto icon-[lucide--chevron-right] size-4"
        />
      </a>
      <div
        v-else
        class="flex w-full items-center justify-between select-none"
        data-testid="nodes-2-toggle-item"
      >
        <span class="text-nowrap">{{ item.label }}</span>
        <Switch
          :model-value="nodes2Enabled"
          class="pointer-events-none ml-4"
          aria-hidden="true"
          readonly
          tabindex="-1"
        />
      </div>
    </template>
  </Menu>
</template>

<script setup lang="ts">
import { computed, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import ComfyLogo from '@/components/icons/ComfyLogo.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Switch from '@/components/ui/switch/Switch.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { SettingPanelType } from '@/platform/settings/types'
import { useTelemetry } from '@/platform/telemetry'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useCommandStore } from '@/stores/commandStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import type { AppMenuItem, CommandMenuItem } from '@/stores/menuItemStore'
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
const settingsDialog = useSettingsDialog()
const managerState = useManagerState()
const settingStore = useSettingStore()

const nodes2Enabled = computed(
  () => settingStore.get('Comfy.VueNodes.Enabled') ?? false
)

const telemetry = useTelemetry()

function onLogoMenuClick() {
  telemetry?.trackUiButtonClicked({
    button_id: 'sidebar_comfy_menu_opened',
    element_group: 'sidebar'
  })
}

const translateMenuItem = (item: AppMenuItem): AppMenuItem => {
  const label = typeof item.label === 'function' ? item.label() : item.label
  const translatedLabel = label
    ? t(`menuLabels.${normalizeI18nKey(label)}`, label)
    : undefined

  return item.items
    ? {
        ...item,
        label: translatedLabel,
        items: item.items.map(translateMenuItem)
      }
    : { ...item, label: translatedLabel }
}

const showSettings = (defaultPanel?: SettingPanelType) => {
  settingsDialog.show(defaultPanel)
}

const showManageExtensions = async () => {
  await managerState.openManager({
    initialTab: ManagerTab.All,
    showToastOnLegacyError: false
  })
}

const themeMenuItems = computed(() => {
  return colorPaletteStore.palettes.map<CommandMenuItem>((palette) => ({
    key: `theme-${palette.id}`,
    label: palette.name,
    parentPath: 'theme',
    commandId: `theme-${palette.id}`,
    checked: () => colorPaletteStore.activePaletteId === palette.id,
    command: async () => {
      await colorPaletteService.loadColorPalette(palette.id)
    }
  }))
})

const extraMenuItems = computed<MenuItem[]>(() => [
  { separator: true },
  {
    key: 'theme',
    label: t('menu.theme'),
    items: themeMenuItems.value
  },
  {
    key: 'nodes-2.0-toggle',
    label: 'Nodes 2.0',
    checked: nodes2Enabled.value,
    command: () => onNodes2ToggleChange(!nodes2Enabled.value)
  },
  { separator: true },
  {
    key: 'browse-templates',
    label: t('menuLabels.Browse Templates'),
    icon: 'icon-[comfy--template]',
    command: () => useWorkflowTemplateSelectorDialog().show('menu')
  },
  {
    key: 'settings',
    label: t('g.settings'),
    icon: 'icon-[lucide--settings]',
    command: () => {
      telemetry?.trackUiButtonClicked({
        button_id: 'sidebar_settings_menu_opened',
        element_group: 'sidebar'
      })
      showSettings()
    }
  },
  {
    key: 'manage-extensions',
    label: t('menu.manageExtensions'),
    icon: 'icon-[comfy--extensions-blocks]',
    command: showManageExtensions
  }
])

const menuSeparator: MenuItem = { separator: true }

const translatedItems = computed<AppMenuItem[]>(() => {
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
      ...(isLastItem ? [menuSeparator] : [])
    )[0]
  }
  helpIndex = items.length

  items.splice(
    helpIndex,
    0,
    ...extraMenuItems.value,
    ...(helpItem ? [menuSeparator, helpItem] : [])
  )

  return items
})

const isCommandMenuItem = (item: MenuItem): item is CommandMenuItem =>
  'commandId' in item

const isNewBlankWorkflow = (item: MenuItem) =>
  isCommandMenuItem(item) && item.commandId === 'Comfy.NewBlankWorkflow'

const isZoomCommand = (item: MenuItem) => {
  return (
    isCommandMenuItem(item) &&
    (item.commandId === 'Comfy.Canvas.ZoomIn' ||
      item.commandId === 'Comfy.Canvas.ZoomOut')
  )
}

const handleZoomMouseDown = (item: MenuItem, event: MouseEvent) => {
  if (!isZoomCommand(item)) return
  const commandId = isCommandMenuItem(item) ? item.commandId : undefined
  if (commandId) {
    whileMouseDown(
      event,
      async () => {
        await commandStore.execute(commandId)
      },
      50
    )
  }
}

const handleItemClick = (item: MenuItem, event: MouseEvent) => {
  if (isZoomCommand(item) || item.checked !== undefined) {
    event.preventDefault()
    event.stopPropagation()
    if (item.checked !== undefined) {
      item.command?.({
        item,
        originalEvent: event
      })
    }
    return false
  }
}

const hasCheckableSiblings = (item: MenuItem): boolean => {
  return Boolean(
    isCommandMenuItem(item) &&
    item.parentPath &&
    (item.parentPath === 'theme' ||
      menuItemStore.menuGroupHasCheckableItems[item.parentPath])
  )
}

const onNodes2ToggleChange = async (value: boolean) => {
  await settingStore.set('Comfy.VueNodes.Enabled', value)
  telemetry?.trackUiButtonClicked({
    button_id: `menu_nodes_2.0_toggle_${value ? 'enabled' : 'disabled'}`,
    element_group: 'sidebar'
  })
}
</script>
