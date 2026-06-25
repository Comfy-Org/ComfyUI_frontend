<template>
  <DropdownMenu v-model:open="isOpen" :modal="false">
    <DropdownMenuTrigger as-child>
      <div
        v-tooltip="{
          value: t('sideToolbar.labels.menu'),
          showDelay: 300,
          hideDelay: 300
        }"
        class="comfy-menu-button-wrapper flex shrink-0 cursor-pointer flex-col items-center justify-center p-2 transition-colors"
        :class="{ 'comfy-menu-button-active': isOpen }"
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
      </div>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      size="lg"
      align="start"
      :side-offset="4"
      :collision-padding="8"
    >
      <ComfyMenuItem
        v-for="(item, idx) in translatedItems"
        :key="(item.key as string | undefined) ?? idx"
        :item="item"
      />
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyLogo from '@/components/icons/ComfyLogo.vue'
import ComfyMenuItem from '@/components/sidebar/ComfyMenuItem.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import type { SettingPanelType } from '@/platform/settings/types'
import { useTelemetry } from '@/platform/telemetry'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useMenuItemStore } from '@/stores/menuItemStore'
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

const isOpen = ref(false)
const telemetry = useTelemetry()

function onLogoMenuClick() {
  telemetry?.trackUiButtonClicked({
    button_id: 'sidebar_comfy_menu_opened',
    element_group: 'sidebar'
  })
}

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

const showSettings = (defaultPanel?: SettingPanelType) => {
  settingsDialog.show(defaultPanel)
}

const showManageExtensions = async () => {
  await managerState.openManager({
    initialTab: ManagerTab.All,
    showToastOnLegacyError: false
  })
}

const themeMenuItems = computed(() =>
  colorPaletteStore.palettes.map((palette) => ({
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
)

const extraMenuItems = computed(() => [
  { separator: true },
  {
    key: 'theme',
    label: t('menu.theme'),
    items: themeMenuItems.value
  },
  {
    key: 'nodes-2.0-toggle',
    label: 'Nodes 2.0'
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

const translatedItems = computed(() => {
  const items = menuItemStore.menuItems.map(translateMenuItem)
  let helpIndex = items.findIndex((item) => item.key === 'Help')
  let helpItem: MenuItem | undefined

  if (helpIndex !== -1) {
    items[helpIndex].icon = 'icon-[lucide--circle-help]'
    const isLastItem = helpIndex !== items.length - 1
    helpItem = items.splice(
      helpIndex,
      1,
      ...(isLastItem ? [{ separator: true }] : [])
    )[0]
  }
  helpIndex = items.length

  items.splice(
    helpIndex,
    0,
    ...extraMenuItems.value,
    ...(helpItem ? [{ separator: true }, helpItem] : [])
  )

  return items
})
</script>

<style scoped>
.comfy-menu-button-wrapper {
  width: var(--sidebar-width);
  height: var(--sidebar-item-height);
}

.comfy-menu-button-wrapper:hover {
  background: var(--interface-panel-hover-surface);
}

.comfy-menu-button-active,
.comfy-menu-button-active:hover {
  background: var(--interface-panel-selected-surface);
}
</style>
