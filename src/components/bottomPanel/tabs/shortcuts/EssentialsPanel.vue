<template>
  <div class="h-full flex flex-col p-4">
    <div class="flex-1 min-h-0 overflow-auto">
      <ShortcutsList
        :commands="essentialsCommands"
        :subcategories="essentialsSubcategories"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
  ESSENTIALS_CONFIG,
  useCommandSubcategories
} from '@/composables/bottomPanelTabs/useCommandSubcategories'
import { useCommandStore } from '@/stores/commandStore'

import ShortcutsList from './ShortcutsList.vue'

const commandStore = useCommandStore()

const essentialsCommands = computed(() =>
  commandStore.commands.filter((cmd) => cmd.category === 'essentials')
)

const { subcategories: essentialsSubcategories } = useCommandSubcategories(
  essentialsCommands,
  ESSENTIALS_CONFIG
)
</script>
