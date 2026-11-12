<template>
  <div class="flex items-center gap-2 px-4 py-2">
    <div class="min-w-0 flex-1">
      <slot />
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
