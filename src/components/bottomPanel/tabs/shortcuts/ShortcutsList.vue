<template>
  <div class="shortcuts-list flex justify-center">
    <div class="grid gap-4 md:gap-24 h-full grid-cols-1 md:grid-cols-3 w-[90%]">
      <div
        v-for="(subcategoryCommands, subcategory) in filteredSubcategories"
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
            v-for="command in subcategoryCommands"
            :key="command.id"
            class="shortcut-item flex justify-between items-center py-2 rounded hover:bg-surface-100 dark-theme:hover:bg-surface-700 transition-colors duration-200"
          >
            <div class="shortcut-info flex-grow pr-4">
              <div class="shortcut-name text-sm font-medium">
                {{ t(`commands.${normalizeI18nKey(command.id)}.label`) }}
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComfyCommandImpl } from '@/stores/commandStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

const { t } = useI18n()

const { subcategories } = defineProps<{
  commands: ComfyCommandImpl[]
  subcategories: Record<string, ComfyCommandImpl[]>
}>()

const filteredSubcategories = computed(() => {
  const result: Record<string, ComfyCommandImpl[]> = {}

  for (const [subcategory, commands] of Object.entries(subcategories)) {
    result[subcategory] = commands.filter((cmd) => !!cmd.keybinding)
  }

  return result
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
