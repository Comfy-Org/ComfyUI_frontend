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
import { useSettingStore } from '@/stores/settingStore'

import SidebarIcon from './SidebarIcon.vue'

const settingStore = useSettingStore()
const currentTheme = computed(() => settingStore.get('Comfy.ColorPalette'))
const icon = computed(() =>
  currentTheme.value !== 'light' ? 'pi pi-moon' : 'pi pi-sun'
)

const commandStore = useCommandStore()
const toggleTheme = () => {
  commandStore.execute('Comfy.ToggleTheme')
}
</script>
