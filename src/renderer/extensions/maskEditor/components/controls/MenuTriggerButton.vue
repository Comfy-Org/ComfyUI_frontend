<template>
  <button
    type="button"
    class="flex h-8 items-center gap-1 rounded-lg border-none bg-secondary px-2 text-sm transition-colors duration-100 hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
  >
    <slot />
    <i
      class="icon-[lucide--chevron-down] size-3 text-muted-foreground"
      aria-hidden="true"
    />
  </button>
</template>
