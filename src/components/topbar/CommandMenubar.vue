<template>
  <Menubar
    :model="items"
    class="top-menubar border-none p-0 bg-transparent"
    :pt="{
      rootList: 'gap-0 flex-nowrap w-auto',
      submenu: `dropdown-direction-${dropdownDirection}`,
      item: 'relative'
    }"
  >
    <template #item="{ item, props }">
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
          class="ml-auto border border-surface rounded text-muted text-xs p-1 keybinding-tag"
        >
          {{ item.comfyCommand.keybinding.combo.toString() }}
        </span>
      </a>
    </template>
  </Menubar>
</template>

<script setup lang="ts">
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSettingStore } from '@/stores/settingStore'
import Menubar from 'primevue/menubar'
import { computed } from 'vue'

const settingStore = useSettingStore()
const dropdownDirection = computed(() =>
  settingStore.get('Comfy.UseNewMenu') === 'Top' ? 'down' : 'up'
)

const menuItemsStore = useMenuItemStore()
const items = menuItemsStore.menuItems
</script>

<style scoped>
.top-menubar :deep(.p-menubar-item-link) svg {
  display: none;
}

:deep(.p-menubar-submenu.dropdown-direction-up) {
  @apply top-auto bottom-full flex-col-reverse;
}

.keybinding-tag {
  background: var(--p-content-hover-background);
  border-color: var(--p-content-border-color);
  border-style: solid;
}
</style>
