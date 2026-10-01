<script setup lang="ts">
const { title, detail, cancelLabel } = defineProps<{
  title: string
  detail: string
  cancelLabel?: string
}>()

const emit = defineEmits<{ cancel: [] }>()
</script>

<template>
  <div
    class="absolute inset-0 flex items-center justify-center rounded-sm bg-primary-comfy-ink/60"
    role="status"
  >
    <slot />
    <div
      class="relative flex items-center gap-3 rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light px-4 py-3"
    >
      <span
        class="size-5 rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow motion-safe:animate-spin"
        aria-hidden="true"
      />
      <span class="flex flex-col gap-0.5">
        <span class="text-sm font-medium text-primary-warm-white">{{
          title
        }}</span>
        <span class="text-xs text-primary-warm-gray tabular-nums">{{
          detail
        }}</span>
      </span>
      <button
        v-if="cancelLabel"
        type="button"
        class="ml-2 h-7 rounded-full border border-primary-comfy-yellow/60 px-3 text-[11px] font-semibold tracking-wide text-primary-comfy-yellow uppercase transition hover:bg-primary-comfy-yellow/10 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="emit('cancel')"
      >
        {{ cancelLabel }}
      </button>
    </div>
  </div>
</template>
