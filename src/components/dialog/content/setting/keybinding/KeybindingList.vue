<template>
  <span
    v-if="keybindings.length > 0"
    class="@container/keybindings flex w-full min-w-0 items-center gap-1 overflow-hidden"
    data-testid="keybinding-list"
  >
    <KeyComboDisplay
      :key-combo="keybindings[0].combo"
      :is-modified="isModified"
    />
    <template v-if="keybindings.length >= 2">
      <span
        class="hidden text-muted-foreground @[16rem]/keybindings:inline"
        aria-hidden="true"
      >
        ,
      </span>
      <KeyComboDisplay
        class="hidden @[16rem]/keybindings:inline-flex"
        :key-combo="keybindings[1].combo"
        :is-modified="isModified"
      />
    </template>
    <span
      v-if="keybindings.length > 2"
      class="hidden rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground @[16rem]/keybindings:inline"
      data-testid="keybinding-list-more-wide"
    >
      {{ $t('g.nMoreKeybindings', { count: keybindings.length - 2 }) }}
    </span>
    <span
      v-if="keybindings.length >= 2"
      class="hidden rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground @[12rem]/keybindings:inline @[16rem]/keybindings:hidden"
      data-testid="keybinding-list-more-medium"
    >
      {{ $t('g.nMoreKeybindings', { count: keybindings.length - 1 }) }}
    </span>
    <span
      v-if="keybindings.length >= 2"
      class="hidden rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground @[8rem]/keybindings:inline @[12rem]/keybindings:hidden"
      data-testid="keybinding-list-more-compact"
    >
      {{ $t('g.nMoreKeybindingsCompact', { count: keybindings.length - 1 }) }}
    </span>
    <span class="sr-only" data-testid="keybinding-list-aria">
      {{ ariaLabel }}
    </span>
  </span>
  <span v-else>-</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { KeybindingImpl } from '@/platform/keybindings/keybinding'

import KeyComboDisplay from './KeyComboDisplay.vue'

const { keybindings, isModified = false } = defineProps<{
  keybindings: KeybindingImpl[]
  isModified?: boolean
}>()

const { t } = useI18n()

const ariaLabel = computed(() => {
  if (keybindings.length === 0) return ''
  const combos = keybindings
    .map((binding) => binding.combo.toString())
    .join(', ')
  return t('g.keybindingListAriaLabel', { combos })
})
</script>
