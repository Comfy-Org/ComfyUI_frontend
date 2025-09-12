<template>
  <div
    v-if="option.type === 'divider'"
    class="h-px bg-gray-200 dark-theme:bg-zinc-700 my-1"
  />
  <div
    v-else
    role="button"
    class="flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer"
    @click="handleClick"
  >
    <i v-if="option.icon" :class="[option.icon, 'w-4 h-4']" />
    <span class="flex-1">{{ option.label }}</span>
    <span v-if="option.shortcut" class="text-xs opacity-60">
      {{ option.shortcut }}
    </span>
    <i-lucide:chevron-right
      v-if="option.hasSubmenu"
      :size="14"
      class="opacity-60"
    />
    <Badge
      v-if="option.badge"
      :severity="option.badge === 'new' ? 'info' : 'secondary'"
      :value="t(option.badge)"
      :class="{
        'bg-[#31B9F4] dark-theme:bg-[#0B8CE9] rounded-4xl':
          option.badge === 'new',
        'bg-[#9C9EAB] dark-theme:bg-[#000] rounded-4xl':
          option.badge === 'deprecated',
        'text-white uppercase text-[9px] h-4 px-1 gap-2.5': true
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
