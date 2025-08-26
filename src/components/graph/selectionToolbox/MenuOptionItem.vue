<template>
  <div
    v-if="props.option.type === 'divider'"
    class="h-px bg-gray-200 dark-theme:bg-zinc-700 my-1"
  />
  <div
    v-else
    :ref="
      props.option.hasSubmenu
        ? `submenu-trigger-${props.option.label}`
        : undefined
    "
    role="button"
    class="flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer"
    @click="handleClick"
  >
    <component :is="props.option.icon" v-if="props.option.icon" :size="16" />
    <span class="flex-1">{{ props.option.label }}</span>
    <span v-if="props.option.shortcut" class="text-xs opacity-60">
      {{ props.option.shortcut }}
    </span>
    <i-lucide:chevron-right
      v-if="props.option.hasSubmenu"
      :size="14"
      class="opacity-60"
    />
  </div>
</template>

<script setup lang="ts">
import type { MenuOption } from '@/composables/graph/useMoreOptionsMenu'

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
