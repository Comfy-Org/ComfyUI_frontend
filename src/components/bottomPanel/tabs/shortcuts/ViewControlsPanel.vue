<template>
  <div class="h-full flex flex-col p-4">
    <div class="flex-1 min-h-0 overflow-auto">
      <ShortcutsList
        :commands="viewControlsCommands"
        :subcategories="viewControlsSubcategories"
        :columns="2"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useCommandStore } from '@/stores/commandStore'

import ShortcutsList from './ShortcutsList.vue'

const commandStore = useCommandStore()

const viewControlsCommands = computed(() =>
  commandStore.commands.filter((cmd) => cmd.category === 'view-controls')
)

const viewControlsSubcategories = computed(() => {
  const subcategories: Record<string, any[]> = {}

  for (const command of viewControlsCommands.value) {
    let subcategory = 'view'

    if (command.id.includes('Zoom') || command.id.includes('Fit')) {
      subcategory = 'view'
    } else if (command.id.includes('Panel') || command.id.includes('Sidebar')) {
      subcategory = 'panel-controls'
    }

    if (!subcategories[subcategory]) {
      subcategories[subcategory] = []
    }
    subcategories[subcategory].push(command)
  }

  return subcategories
})
</script>
