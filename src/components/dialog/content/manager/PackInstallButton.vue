<template>
  <Button
    outlined
    class="m-0 p-0 rounded-lg border-neutral-700"
    severity="secondary"
    :class="{
      'w-full': fullWidth,
      'w-min-content': !fullWidth
    }"
  >
    <span class="py-2.5 px-3">
      {{ multi ? $t('manager.installSelected') : $t('g.install') }}
    </span>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

defineProps<{
  fullWidth?: boolean
  multi?: boolean
}>()
</script>
