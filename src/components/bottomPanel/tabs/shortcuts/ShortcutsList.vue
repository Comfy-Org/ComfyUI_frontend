<template>
  <div class="shortcuts-list">
    <div class="grid gap-8 h-full grid-cols-3">
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
            class="shortcut-item flex justify-between items-center py-2 rounded hover:bg-surface-100 dark-theme:hover:bg-surface-700 transition-colors duration-200"
          >
            <div class="shortcut-info flex-grow pr-4">
              <div class="shortcut-name text-sm font-medium">
                {{ command.label || command.id }}
              </div>
            </div>

            <div class="keybinding-display flex-shrink-0">
              <div
                class="keybinding-combo flex gap-1"
                :aria-label="`Keyboard shortcut: ${command.keybinding!.combo.getKeySequences().join(' + ')}`"
              >
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
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { ComfyCommandImpl } from '@/stores/commandStore'

const { t } = useI18n()

const { subcategories } = defineProps<{
  commands: ComfyCommandImpl[]
  subcategories: Record<string, ComfyCommandImpl[]>
}>()

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
