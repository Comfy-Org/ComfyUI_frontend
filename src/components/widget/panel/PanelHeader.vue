<template>
  <header class="flex h-16 items-center justify-between px-6">
    <div class="flex items-center gap-2 pl-1">
      <slot name="icon">
        <i class="text-neutral icon-[lucide--puzzle] text-base" />
      </slot>
      <h2 class="text-neutral text-base font-bold">
        <slot></slot>
      </h2>
    </div>
  </header>
</template>
