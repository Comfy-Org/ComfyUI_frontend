<template>
  <div v-if="option.type === 'divider'" class="my-1 h-px bg-border-default" />
  <div
    v-else
    role="button"
    class="group flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-text-primary hover:bg-interface-menu-component-surface-hovered"
    @click="handleClick"
  >
    <i v-if="option.icon" :class="[option.icon, 'h-4 w-4']" />
    <span class="flex-1">{{ option.label }}</span>
    <span
      v-if="option.shortcut"
      class="flex h-3.5 min-w-3.5 items-center justify-center rounded bg-interface-menu-keybind-surface-default px-1 py-0 text-xxs"
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
      :class="
        cn(
          'h-4 gap-2.5 px-1 text-[9px] text-base-foreground uppercase rounded-4xl',
          {
            'bg-primary-background': option.badge === 'new',
            'bg-secondary-background': option.badge === 'deprecated'
          }
        )
      "
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
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
