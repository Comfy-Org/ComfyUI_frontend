<template>
  <div class="flex h-11 items-center gap-3 pr-3 pl-3.5">
    <span class="flex-1">{{ label }}</span>
    <Transition
      mode="out-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition-opacity duration-200 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-150 motion-reduce:transition-none"
    >
      <span :key="note" class="text-muted-foreground tabular-nums">
        {{ note }}
      </span>
    </Transition>
    <span class="grid w-4 shrink-0 place-items-center">
      <Transition
        mode="out-in"
        enter-from-class="scale-50 opacity-0"
        leave-to-class="scale-50 opacity-0"
        enter-active-class="transition duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
        leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
      >
        <i
          v-if="state === 'running'"
          key="running"
          class="icon-[lucide--loader-circle] animate-spin text-foreground"
          aria-hidden="true"
        />
        <i
          v-else-if="state === 'done'"
          key="done"
          class="icon-[lucide--check] text-foreground"
          aria-hidden="true"
        />
        <i
          v-else-if="state === 'failed'"
          key="failed"
          class="icon-[lucide--x] text-destructive"
          aria-hidden="true"
        />
      </Transition>
    </span>
  </div>
</template>

<script setup lang="ts">
const { label, note, state } = defineProps<{
  label: string
  note: string
  state: 'waiting' | 'running' | 'done' | 'failed'
}>()
</script>
