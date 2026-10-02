<script setup lang="ts">
const { title, detail } = defineProps<{ title: string; detail: string }>()
</script>

<template>
  <div
    class="absolute inset-0 flex items-center justify-center rounded-sm bg-primary-comfy-ink/60"
    role="status"
  >
    <div
      class="flex items-center gap-3 rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light px-4 py-3"
    >
      <span
        class="size-5 rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow motion-safe:animate-spin"
        aria-hidden="true"
      />
      <span class="flex flex-col gap-0.5">
        <span class="text-sm font-medium text-primary-warm-white">{{
          title
        }}</span>
        <span class="text-xs text-primary-warm-gray">{{ detail }}</span>
      </span>
    </div>
  </div>
</template>
