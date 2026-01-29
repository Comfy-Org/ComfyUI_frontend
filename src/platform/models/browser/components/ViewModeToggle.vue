<template>
  <div
    class="flex items-center rounded-lg bg-secondary-background p-1 gap-1 shrink-0"
  >
    <button
      :class="
        cn(
          'inline-flex items-center justify-center cursor-pointer appearance-none border-none transition-colors h-7 w-7 sm:h-8 sm:w-8 rounded-md',
          modelValue === 'grid'
            ? 'bg-base-background text-base-foreground'
            : 'bg-transparent text-muted-foreground hover:text-base-foreground'
        )
      "
      :aria-label="$t('modelBrowser.viewGrid')"
      @click="$emit('update:modelValue', 'grid')"
    >
      <i class="icon-[lucide--grid-3x3] size-3.5 sm:size-4" />
    </button>
    <button
      :class="
        cn(
          'inline-flex items-center justify-center cursor-pointer appearance-none border-none transition-colors h-7 w-7 sm:h-8 sm:w-8 rounded-md',
          modelValue === 'list'
            ? 'bg-base-background text-base-foreground'
            : 'bg-transparent text-muted-foreground hover:text-base-foreground'
        )
      "
      :aria-label="$t('modelBrowser.viewList')"
      @click="$emit('update:modelValue', 'list')"
    >
      <i class="icon-[lucide--list] size-3.5 sm:size-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  modelValue: 'grid' | 'list'
}>()

defineEmits<{
  'update:modelValue': [value: 'grid' | 'list']
}>()
</script>
