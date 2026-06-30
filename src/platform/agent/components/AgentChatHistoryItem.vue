<script setup lang="ts">
const { active = false } = defineProps<{
  active?: boolean
}>()

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <li
    class="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary-background-hover"
    :class="{ 'bg-secondary-background': active }"
  >
    <button
      type="button"
      class="flex flex-1 items-center gap-2 overflow-hidden border-0 bg-transparent text-left text-xs text-base-foreground"
      @click="emit('select')"
    >
      <i
        class="icon-[lucide--circle-check] size-3.5 shrink-0 text-muted-foreground"
      />
      <slot />
    </button>
    <button
      type="button"
      class="hidden shrink-0 items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-muted-foreground group-hover:flex hover:text-base-foreground"
      :aria-label="$t('g.more')"
    >
      <i class="icon-[lucide--ellipsis] size-3.5" />
    </button>
  </li>
</template>
