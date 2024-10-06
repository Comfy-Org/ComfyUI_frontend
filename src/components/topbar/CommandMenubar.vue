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
    <template #item="{ item, props, root }">
      <a class="p-menubar-item-link" v-bind="props.action">
        <span v-if="item.icon" class="p-menubar-item-icon" :class="item.icon" />
        <span class="p-menubar-item-label">{{ item.label }}</span>
        <Badge
          v-if="item.badge"
          :class="{ 'ml-auto': !root, 'ml-2': root }"
          :value="item.badge"
        />
        <span
          v-if="!root && keybindings[item.id]"
          class="ml-auto border border-surface rounded text-muted text-xs p-1 keybinding-tag"
        >
          {{ keybindings[item.id] }}
        </span>
      </a>
    </template>
  </Menubar>
</template>

<script setup lang="ts">
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useSettingStore } from '@/stores/settingStore'
import Menubar from 'primevue/menubar'
import Badge from 'primevue/badge'
import { computed } from 'vue'
import type { MenuItem } from 'primevue/menuitem'

const settingStore = useSettingStore()
const dropdownDirection = computed(() =>
  settingStore.get('Comfy.UseNewMenu') === 'Top' ? 'down' : 'up'
)

const menuItemsStore = useMenuItemStore()
const items = menuItemsStore.menuItems

const keybindingStore = useKeybindingStore()
const keybindings = computed(() => {
  const bindings: Record<string, string> = {}
  const stack: MenuItem[] = [...items]

  while (stack.length) {
    const item = stack.pop()!
    if (item.id) {
      // Is ComfyMenuItem with commandId
      const keybinding = keybindingStore.getKeybindingByCommandId(item.id)
      if (keybinding) {
        bindings[item.id] = keybinding.combo.toString()
      }
    }
    if (item.items) {
      stack.push(...item.items)
    }
  }
  return bindings
})
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
