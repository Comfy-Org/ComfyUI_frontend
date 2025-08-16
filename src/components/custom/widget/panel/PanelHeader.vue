<template>
  <header class="flex items-center justify-between h-16 px-6">
    <div class="flex items-center gap-2 pl-1">
      <slot name="icon">
        <i-lucide:puzzle class="text-neutral text-base" />
      </slot>
      <h2 class="font-bold text-base text-neutral">
        <slot></slot>
      </h2>
    </div>
  </header>
</template>
