<template>
  <div v-if="activeMenuPane" class="w-full h-full relative z-20">
    <component
      :is="activeMenuPane.component"
      v-bind="activeMenuPane.props || {}"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useMenuPaneStore } from '@/stores/menuPaneStore'

const menuPaneStore = useMenuPaneStore()
const activeMenuPane = computed(() => menuPaneStore.activeMenuPane)
</script>
