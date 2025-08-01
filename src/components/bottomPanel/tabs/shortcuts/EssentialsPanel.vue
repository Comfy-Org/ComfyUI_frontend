<template>
  <div class="h-full flex flex-col p-4">
    <div class="flex-1 min-h-0 overflow-auto">
      <ShortcutsList
        :commands="essentialsCommands"
        :subcategories="essentialsSubcategories"
        :columns="3"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useCommandStore } from '@/stores/commandStore'

import ShortcutsList from './ShortcutsList.vue'

const commandStore = useCommandStore()

const essentialsCommands = computed(() =>
  commandStore.commands.filter((cmd) => cmd.category === 'essentials')
)

// Group commands by subcategory based on command ID patterns
const essentialsSubcategories = computed(() => {
  const subcategories: Record<string, any[]> = {}

  for (const command of essentialsCommands.value) {
    let subcategory = 'workflow'

    if (command.id.includes('Workflow')) {
      subcategory = 'workflow'
    } else if (command.id.includes('Node')) {
      subcategory = 'node'
    } else if (command.id.includes('Queue')) {
      subcategory = 'queue'
    }

    if (!subcategories[subcategory]) {
      subcategories[subcategory] = []
    }
    subcategories[subcategory].push(command)
  }

  return subcategories
})
</script>
