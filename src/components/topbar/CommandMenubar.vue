<template>
  <Menubar
    :model="translatedItems"
    class="top-menubar border-none p-0 bg-transparent"
    :pt="{
      rootList: 'gap-0 flex-nowrap w-auto',
      submenu: `dropdown-direction-${dropdownDirection}`,
      item: 'relative'
    }"
  >
    <template #item="{ item, props, root }">
      <a
        class="p-menubar-item-link"
        v-bind="props.action"
        :href="item.url"
        target="_blank"
      >
        <span v-if="item.icon" class="p-menubar-item-icon" :class="item.icon" />
        <span class="p-menubar-item-label">{{ item.label }}</span>
        <span
          v-if="item?.comfyCommand?.keybinding"
          class="ml-auto border border-surface rounded text-muted text-xs text-nowrap p-1 keybinding-tag"
        >
          {{ item.comfyCommand.keybinding.combo.toString() }}
        </span>
        <i v-if="!root && item.items" class="ml-auto pi pi-angle-right" />
      </a>
    </template>
  </Menubar>
</template>

<script setup lang="ts">
import Menubar from 'primevue/menubar'
import type { MenuItem } from 'primevue/menuitem'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSettingStore } from '@/stores/settingStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

const settingStore = useSettingStore()
const dropdownDirection = computed(() =>
  settingStore.get('Comfy.UseNewMenu') === 'Top' ? 'down' : 'up'
)

const menuItemsStore = useMenuItemStore()
const { t } = useI18n()
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

const translatedItems = computed(() =>
  menuItemsStore.menuItems.map(translateMenuItem)
)
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
</style>
