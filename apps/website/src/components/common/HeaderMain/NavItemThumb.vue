<script setup lang="ts">
import { ref, watch } from 'vue'

const { src, name } = defineProps<{ src?: string; name: string }>()

const failed = ref(false)
watch(
  () => src,
  () => (failed.value = false)
)
</script>

<template>
  <img
    v-if="src && !failed"
    :src
    alt=""
    class="size-12 shrink-0 rounded-lg bg-hub-surface-hover object-cover"
    loading="lazy"
    decoding="async"
    draggable="false"
    data-testid="nav-item-thumb"
    @error="failed = true"
  />
  <span
    v-else
    class="grid size-12 shrink-0 place-items-center rounded-lg bg-hub-surface-hover font-formula text-lg font-bold text-primary-warm-white/30 select-none"
    aria-hidden="true"
    data-testid="nav-item-thumb-placeholder"
  >
    {{ name[0] }}
  </span>
</template>
