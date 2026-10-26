<!-- One row of the deployment switcher's list (FE-2434): a label, a caption,
     and a check on the row this browser runs on. `checked: null` makes it an
     action row rather than a choice. -->
<template>
  <button
    type="button"
    :role="checked === null ? 'menuitem' : 'menuitemradio'"
    :aria-checked="checked ?? undefined"
    :class="
      cn(
        'flex w-full cursor-pointer appearance-none items-center gap-2 border-0 border-b border-border-default bg-transparent px-4 py-3 text-left',
        'hover:bg-secondary-background-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
        checked && 'bg-secondary-background'
      )
    "
  >
    <div class="flex min-w-0 flex-1 flex-col items-start gap-0.5">
      <span class="truncate text-sm text-base-foreground">{{ label }}</span>
      <span class="text-xs text-muted-foreground">{{ caption }}</span>
    </div>
    <i
      v-if="checked"
      class="pi pi-check shrink-0 text-sm text-base-foreground"
    />
  </button>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { label, caption, checked } = defineProps<{
  label: string
  caption: string
  checked: boolean | null
}>()
</script>
