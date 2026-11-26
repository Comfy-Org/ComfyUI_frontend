<template>
  <div class="flex h-11 items-center gap-3 pr-3 pl-3.5">
    <span class="flex-1">{{ label }}</span>
    <span class="text-muted-foreground tabular-nums">{{ note }}</span>
    <span class="flex w-4 shrink-0 justify-center">
      <Spinner v-if="state === 'running'" class="size-4 text-foreground" />
      <i
        v-else-if="state === 'done'"
        class="icon-[lucide--check] text-foreground"
        aria-hidden="true"
      />
      <i
        v-else-if="state === 'failed'"
        class="icon-[lucide--x] text-destructive"
        aria-hidden="true"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import Spinner from '@comfyorg/design-system/spinner/Spinner'

const { label, note, state } = defineProps<{
  label: string
  note: string
  state: 'waiting' | 'running' | 'done' | 'failed'
}>()
</script>
