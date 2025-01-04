<template>
  <SidebarIcon
    :icon="icon"
    @click="toggleTheme"
    :tooltip="$t('sideToolbar.themeToggle')"
    class="comfy-vue-theme-toggle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useCommandStore } from '@/stores/commandStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import SidebarIcon from './SidebarIcon.vue'

const colorPaletteStore = useColorPaletteStore()
const icon = computed(() =>
  colorPaletteStore.completedActivePalette.light_theme
    ? 'pi pi-sun'
    : 'pi pi-moon'
)

const commandStore = useCommandStore()
const toggleTheme = () => {
  commandStore.execute('Comfy.ToggleTheme')
}
</script>
