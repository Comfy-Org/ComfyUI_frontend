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
  </Menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import ComfyLogo from '@/components/icons/ComfyLogo.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { SettingPanelType } from '@/platform/settings/types'
import { useTelemetry } from '@/platform/telemetry'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useMenuItemStore } from '@/stores/menuItemStore'
import type { AppMenuItem, CommandMenuItem } from '@/stores/menuItemStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const { t } = useI18n()
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
    presentation: 'switch',
    class: 'select-none',
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

const onNodes2ToggleChange = async (value: boolean) => {
  await settingStore.set('Comfy.VueNodes.Enabled', value)
  telemetry?.trackUiButtonClicked({
    button_id: `menu_nodes_2.0_toggle_${value ? 'enabled' : 'disabled'}`,
    element_group: 'sidebar'
  })
}
</script>
