<template>
  <ComboboxItem
    :value="option"
    :text-value="option.label"
    :aria-label="
      option.kind === 'folder'
        ? `${$t('icon.folder')}: ${option.label}`
        : option.kind === 'back'
          ? `${$t('g.back')}: ${option.label}`
          : option.label
    "
    class="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-sm p-2 outline-none select-none hover:bg-secondary data-highlighted:bg-secondary data-[state=checked]:bg-primary/20 data-[state=checked]:hover:bg-primary/20 data-[state=checked]:data-highlighted:bg-primary/30"
    @select="$emit('select', $event)"
  >
    <i
      v-if="option.kind !== 'value'"
      :class="
        cn(
          'text-muted-foreground',
          option.kind === 'back'
            ? 'icon-[lucide--arrow-left]'
            : 'icon-[lucide--folder]'
        )
      "
      aria-hidden="true"
    />
    <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
    <i
      v-if="option.kind === 'folder'"
      class="icon-[lucide--chevron-right] text-muted-foreground"
      aria-hidden="true"
    />
    <ComboboxItemIndicator class="flex shrink-0 items-center justify-center">
      <i
        class="icon-[lucide--check] size-3.5 text-foreground"
        aria-hidden="true"
      />
    </ComboboxItemIndicator>
  </ComboboxItem>
</template>

<script setup lang="ts">
import { ComboboxItem, ComboboxItemIndicator } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

const { option } = defineProps<{
  option: { kind: 'value' | 'folder' | 'back'; label: string }
}>()

defineEmits<{ select: [event: Event] }>()
</script>
