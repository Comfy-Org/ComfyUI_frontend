<template>
  <teleport :to="teleportTarget">
    <div
      ref="topMenuRef"
      class="comfyui-menu flex items-center"
      v-show="betaMenuEnabled"
      :class="{ dropzone: isDropZone, 'dropzone-active': isDroppable }"
    >
      <h1 class="comfyui-logo mx-2">ComfyUI</h1>
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
          <a v-ripple class="p-menubar-item-link" v-bind="props.action">
            <span
              v-if="item.icon"
              class="p-menubar-item-icon"
              :class="item.icon"
            />
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
      <Divider layout="vertical" class="mx-2" />
      <div class="flex-grow">
        <WorkflowTabs v-if="workflowTabsPosition === 'Topbar'" />
      </div>
      <div class="comfyui-menu-right" ref="menuRight"></div>
      <Actionbar />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import Menubar from 'primevue/menubar'
import Divider from 'primevue/divider'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import Actionbar from '@/components/actionbar/ComfyActionbar.vue'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { computed, onMounted, provide, ref } from 'vue'
import { useSettingStore } from '@/stores/settingStore'
import { app } from '@/scripts/app'
import { useEventBus } from '@vueuse/core'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { MenuItem } from 'primevue/menuitem'

const settingStore = useSettingStore()
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
const teleportTarget = computed(() =>
  settingStore.get('Comfy.UseNewMenu') === 'Top'
    ? '.comfyui-body-top'
    : '.comfyui-body-bottom'
)
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

const menuRight = ref<HTMLDivElement | null>(null)
// Menu-right holds legacy topbar elements attached by custom scripts
onMounted(() => {
  if (menuRight.value) {
    menuRight.value.appendChild(app.menu.element)
  }
})

const topMenuRef = ref<HTMLDivElement | null>(null)
provide('topMenuRef', topMenuRef)
const eventBus = useEventBus<string>('topMenu')
const isDropZone = ref(false)
const isDroppable = ref(false)
eventBus.on((event: string, payload: any) => {
  if (event === 'updateHighlight') {
    isDropZone.value = payload.isDragging
    isDroppable.value = payload.isOverlapping && payload.isDragging
  }
})
</script>

<style scoped>
.comfyui-menu {
  width: 100vw;
  background: var(--comfy-menu-bg);
  color: var(--fg-color);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.8em;
  box-sizing: border-box;
  z-index: 1000;
  order: 0;
  grid-column: 1/-1;
  max-height: 90vh;
}

.comfyui-menu.dropzone {
  background: var(--p-highlight-background);
}

.comfyui-menu.dropzone-active {
  background: var(--p-highlight-background-focus);
}

.comfyui-logo {
  font-size: 1.2em;
  user-select: none;
  cursor: default;
}

.keybinding-tag {
  background: var(--p-content-hover-background);
  border-color: var(--p-content-border-color);
  border-style: solid;
}
</style>

<style>
.top-menubar .p-menubar-item-link svg {
  display: none;
}

.p-menubar-submenu.dropdown-direction-up {
  @apply top-auto bottom-full flex-col-reverse;
}
</style>
