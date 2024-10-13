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
import SidebarIcon from './SidebarIcon.vue'
import { useSettingStore } from '@/stores/settingStore'
import { useCommandStore } from '@/stores/commandStore'

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
