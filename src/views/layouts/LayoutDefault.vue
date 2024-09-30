<template>
  <main class="LayoutDefault w-full min-h-screen flex flex-col relative">
    <TopMenubar v-if="betaMenuEnabled" />
    <SideToolbar v-if="betaMenuEnabled" />

    <div class="RouterWrapper flex-1 overflow-hidden">
      <router-view />
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingStore } from '@/stores/settingStore'
import TopMenubar from '@/components/topbar/TopMenubar.vue'
import SideToolbar from '@/components/sidebar/SideToolbar.vue'
import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'

const settingStore = useSettingStore()

const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)
</script>
