<template>
  <div
    v-if="option.type === 'divider'"
    class="bg-smoke-200 dark-theme:bg-zinc-700 my-1 h-px"
  />
  <div
    v-else
    role="button"
    class="text-text-primary hover:bg-interface-menu-component-surface-hovered group flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-left text-sm"
    @click="handleClick"
  >
    <i v-if="option.icon" :class="[option.icon, 'size-4']" />
    <span class="flex-1">{{ option.label }}</span>
    <span
      v-if="option.shortcut"
      class="bg-interface-menu-keybind-surface-default text-xxs flex h-3.5 min-w-3.5 items-center justify-center rounded px-1 py-0"
    >
      {{ option.shortcut }}
    </span>
    <i
      v-if="option.hasSubmenu"
      :size="14"
      class="icon-[lucide--chevron-right] opacity-60"
    />
    <Badge
      v-if="option.badge"
      :severity="option.badge === 'new' ? 'info' : 'secondary'"
      :value="t(option.badge)"
      :class="{
        'rounded-4xl bg-azure-400 dark-theme:bg-azure-600':
          option.badge === 'new',
        'rounded-4xl dark-theme:bg-black bg-slate-100':
          option.badge === 'deprecated',
        'h-4 gap-2.5 px-1 text-[9px] uppercase text-white': true
      }"
    />
  </div>
</template>

<script setup lang="ts">
import Badge from 'primevue/badge'
import { useI18n } from 'vue-i18n'

import type { MenuOption } from '@/composables/graph/useMoreOptionsMenu'

const { t } = useI18n()

interface Props {
  option: MenuOption
}

interface Emits {
  (e: 'click', option: MenuOption, event: Event): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleClick = (event: Event) => {
  emit('click', props.option, event)
}
</script>
