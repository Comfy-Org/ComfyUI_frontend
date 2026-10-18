<script setup lang="ts">
const { title, body } = defineProps<{ title: string; body: string }>()
</script>

<template>
  <main
    class="fixed inset-0 flex items-center justify-center overflow-auto bg-background p-6 font-inter"
  >
    <section
      class="flex w-full max-w-96 flex-col items-center gap-8 text-center"
    >
      <div class="flex flex-col items-center gap-3">
        <slot name="icon" />
        <h1
          class="m-0 text-2xl font-semibold text-balance text-foreground sm:whitespace-nowrap"
        >
          {{ title }}
        </h1>
        <p class="m-0 text-sm/5 text-muted-foreground">
          {{ body }}
        </p>
        <slot name="note" />
      </div>
      <slot />
    </section>
  </main>
</template>
