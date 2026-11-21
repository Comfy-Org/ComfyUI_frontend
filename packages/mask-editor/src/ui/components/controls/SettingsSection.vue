<template>
  <section class="flex flex-col gap-3 py-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="m-0 text-sm font-medium text-foreground">
        <slot name="title" />
      </h3>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>
