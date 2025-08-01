<template>
  <div class="shortcuts-list">
    <div v-if="layout === 'grid'" class="grid gap-8 h-full" :class="gridCols">
      <div
        v-for="(subcategoryCommands, subcategory) in subcategories"
        :key="subcategory"
        class="flex flex-col"
      >
        <h3
          class="subcategory-title text-xs font-bold uppercase tracking-wide text-surface-600 dark-theme:text-surface-400 mb-4"
        >
          {{ getSubcategoryTitle(subcategory) }}
        </h3>

        <div class="flex flex-col gap-1">
          <div
            v-for="command in subcategoryCommands.filter(
              (cmd) => !!cmd.keybinding
            )"
            :key="command.id"
            class="shortcut-item flex justify-between items-center py-2 rounded hover:bg-surface-100 dark-theme:hover:bg-surface-700"
          >
            <div class="shortcut-info flex-grow pr-4">
              <div class="shortcut-name text-sm font-medium">
                {{ command.label || command.id }}
              </div>
            </div>

            <div class="keybinding-display flex-shrink-0">
              <div class="keybinding-combo flex gap-1">
                <span
                  v-for="key in command.keybinding!.combo.getKeySequences()"
                  :key="key"
                  class="key-badge px-2 py-1 text-xs font-mono bg-surface-200 dark-theme:bg-surface-600 rounded border min-w-6 text-center"
                >
                  {{ formatKey(key) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Legacy list layout -->
    <div v-else>
      <div
        v-for="(subcategoryCommands, subcategory) in subcategories"
        :key="subcategory"
        class="subcategory-section mb-6"
      >
        <h3
          class="subcategory-title text-sm font-bold uppercase tracking-wide text-surface-500 dark-theme:text-surface-400 mb-3"
        >
          {{ getSubcategoryTitle(subcategory) }}
        </h3>

        <div class="shortcuts-grid">
          <div
            v-for="command in subcategoryCommands.filter(
              (cmd) => cmd.keybinding! == null
            )"
            :key="command.id"
            class="shortcut-item flex justify-between items-center py-2 px-3 rounded hover:bg-surface-100 dark-theme:hover:bg-surface-700"
          >
            <div class="shortcut-info flex-grow">
              <div class="shortcut-name text-sm font-medium">
                {{ command.label || command.id }}
              </div>
            </div>

            <div class="keybinding-display">
              <div class="keybinding-combo flex gap-1">
                <span
                  v-for="key in command.keybinding!.combo.getKeySequences()"
                  :key="key"
                  class="key-badge px-2 py-1 text-xs font-mono bg-surface-200 dark-theme:bg-surface-600 rounded border"
                >
                  {{ formatKey(key) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComfyCommandImpl } from '@/stores/commandStore'

const { t } = useI18n()

const {
  subcategories,
  layout = 'list',
  columns = 2
} = defineProps<{
  commands: ComfyCommandImpl[]
  subcategories: Record<string, ComfyCommandImpl[]>
  layout?: 'list' | 'grid'
  columns?: number
}>()

const gridCols = computed(() => {
  const colsMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  }
  return colsMap[columns] || 'grid-cols-2'
})

const getSubcategoryTitle = (subcategory: string): string => {
  const titleMap: Record<string, string> = {
    workflow: t('shortcuts.subcategories.workflow'),
    node: t('shortcuts.subcategories.node'),
    queue: t('shortcuts.subcategories.queue'),
    view: t('shortcuts.subcategories.view'),
    'panel-controls': t('shortcuts.subcategories.panelControls')
  }

  return titleMap[subcategory] || subcategory
}

const formatKey = (key: string): string => {
  const keyMap: Record<string, string> = {
    Control: 'Ctrl',
    Meta: 'Cmd',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Backspace: '⌫',
    Delete: '⌦',
    Enter: '↵',
    Escape: 'Esc',
    Tab: '⇥',
    ' ': 'Space'
  }

  return keyMap[key] || key
}
</script>

<style scoped>
.subcategory-title {
  color: var(--p-text-muted-color);
}

.shortcuts-grid {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.shortcut-item {
  transition: background-color 0.2s ease;
}

.key-badge {
  background-color: var(--p-surface-200);
  border: 1px solid var(--p-surface-300);
  min-width: 1.5rem;
  text-align: center;
}

.dark-theme .key-badge {
  background-color: var(--p-surface-600);
  border-color: var(--p-surface-500);
}
</style>
