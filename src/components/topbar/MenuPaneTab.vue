<template>
  <div
    class="flex p-2 gap-2 cursor-pointer group"
    ref="menuPaneTabRef"
    v-bind="$attrs"
    @contextmenu="onContextMenu"
  >
    <i v-if="tab.icon" :class="[tab.icon, 'mr-2']"></i>
    <span class="text-sm max-w-[150px] truncate inline-block">
      {{ tab.label }}
    </span>

    <div class="relative">
      <Button
        class="p-0 w-auto invisible group-hover:visible hover:visible"
        icon="pi pi-times"
        text
        severity="secondary"
        size="small"
        @click.stop="onClose"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

import { MenuPaneTabItem } from '@/types/tabTypes'

const { tab } = defineProps<{
  tab: MenuPaneTabItem
}>()

const emit = defineEmits<{
  (e: 'close', tab: MenuPaneTabItem): void
  (e: 'contextmenu', event: MouseEvent, tab: MenuPaneTabItem): void
}>()

const menuPaneTabRef = ref<HTMLElement | null>(null)

const onClose = () => {
  emit('close', tab)
}

const onContextMenu = (event: MouseEvent) => {
  emit('contextmenu', event, tab)
}
</script>
