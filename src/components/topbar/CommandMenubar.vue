<template>
  <div
    class="comfyui-logo-wrapper p-1 flex justify-center items-center cursor-pointer rounded-md mr-2"
    :class="{
      'comfyui-logo-menu-visible': menuRef?.visible
    }"
    :style="{
      minWidth: isLargeSidebar ? '4rem' : 'auto'
    }"
    @click="menuRef?.toggle($event)"
  >
    <img
      src="/assets/images/comfy-logo-mono.svg"
      alt="ComfyUI Logo"
      class="comfyui-logo h-7"
      @contextmenu="showNativeSystemMenu"
    />
    <i class="pi pi-angle-down ml-1 text-[10px]" />
  </div>
  <TieredMenu
    ref="menuRef"
    :model="translatedItems"
    :popup="true"
    class="comfy-command-menu"
    :class="{
      'comfy-command-menu-top': isTopMenu
    }"
    @show="onMenuShow"
  >
    <template #item="{ item, props }">
      <div
        v-if="item.key === 'theme'"
        class="flex items-center gap-4 px-4 py-5"
        @click.stop.prevent
      >
        {{ item.label }}
        <SelectButton
          :options="[darkLabel, lightLabel]"
          :model-value="activeTheme"
          @click.stop.prevent
          @update:model-value="onThemeChange"
        >
          <template #option="{ option }">
            <div class="flex items-center gap-2">
              <i v-if="option === lightLabel" class="pi pi-sun" />
              <i v-if="option === darkLabel" class="pi pi-moon" />
              <span>{{ option }}</span>
            </div>
          </template>
        </SelectButton>
      </div>
      <a
        v-else
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
          class="p-menubar-item-icon"
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
          class="ml-auto border border-surface rounded text-muted text-xs text-nowrap p-1 keybinding-tag"
        >
          {{ item.comfyCommand.keybinding.combo.toString() }}
        </span>
        <i v-if="item.items" class="ml-auto pi pi-angle-right" />
      </a>
    </template>
  </TieredMenu>

  <SubgraphBreadcrumb />
</template>

<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import SelectButton from 'primevue/selectbutton'
import TieredMenu, {
  type TieredMenuMethods,
  type TieredMenuState
} from 'primevue/tieredmenu'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import { useDialogService } from '@/services/dialogService'
import { useAboutPanelStore } from '@/stores/aboutPanelStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSettingStore } from '@/stores/settingStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { showNativeSystemMenu } from '@/utils/envUtil'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { whileMouseDown } from '@/utils/mouseDownUtil'

const colorPaletteStore = useColorPaletteStore()
const menuItemsStore = useMenuItemStore()
const commandStore = useCommandStore()
const dialogStore = useDialogStore()
const aboutPanelStore = useAboutPanelStore()
const settingStore = useSettingStore()
const { t } = useI18n()

const menuRef = ref<
  ({ dirty: boolean } & TieredMenuMethods & TieredMenuState) | null
>(null)
const isLargeSidebar = computed(
  () => settingStore.get('Comfy.Sidebar.Size') !== 'small'
)
const isTopMenu = computed(() => settingStore.get('Comfy.UseNewMenu') === 'Top')

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

// Temporary duplicated from LoadWorkflowWarning.vue
// Determines if ComfyUI-Manager is installed by checking for its badge in the about panel
// This allows us to conditionally show the Manager button only when the extension is available
// TODO: Remove this check when Manager functionality is fully migrated into core
const isManagerInstalled = computed(() => {
  return aboutPanelStore.badges.some(
    (badge) =>
      badge.label.includes('ComfyUI-Manager') ||
      badge.url.includes('ComfyUI-Manager')
  )
})

const showManageExtensions = () => {
  if (isManagerInstalled.value) {
    useDialogService().showManagerDialog()
  } else {
    showSettings('extension')
  }
}

const extraMenuItems = computed<MenuItem[]>(() => [
  { separator: true },
  {
    key: 'theme',
    label: t('menu.theme')
  },
  { separator: true },
  {
    key: 'browse-templates',
    label: t('menuLabels.Browse Templates'),
    icon: 'pi pi-folder-open',
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

const lightLabel = computed(() => t('menu.light'))
const darkLabel = computed(() => t('menu.dark'))

const activeTheme = computed(() => {
  return colorPaletteStore.completedActivePalette.light_theme
    ? lightLabel.value
    : darkLabel.value
})

const onThemeChange = async () => {
  await commandStore.execute('Comfy.ToggleTheme')
}

const translatedItems = computed(() => {
  const items = menuItemsStore.menuItems.map(translateMenuItem)
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
  return menuItemsStore.menuItemHasActiveStateChildren[item.parentPath]
}
</script>

<style scoped>
:deep(.p-menubar-submenu.dropdown-direction-up) {
  @apply top-auto bottom-full flex-col-reverse;
}

.keybinding-tag {
  background: var(--p-content-hover-background);
  border-color: var(--p-content-border-color);
  border-style: solid;
}

.comfyui-logo-menu-visible,
.comfyui-logo-wrapper:hover {
  background-color: color-mix(in srgb, var(--fg-color) 10%, transparent);
}
</style>

<style>
.comfy-command-menu ul {
  background-color: var(--comfy-menu-secondary-bg) !important;
}

.comfy-command-menu-top .p-tieredmenu-submenu {
  left: calc(100% + 15px) !important;
  top: -4px !important;
}
</style>
