<script setup lang="ts">
const { csrf, action, view, now, returnTo } = defineProps<{
  csrf: string
  action?: string
  view?: 'DRAFT' | 'LIVE'
  now?: string
  returnTo: string
}>()
</script>

<template>
  <form data-astro-reload method="post" action="/admin/actions">
    <input type="hidden" name="csrf" :value="csrf" />
    <input v-if="action" type="hidden" name="action" :value="action" />
    <input v-if="view" type="hidden" name="view" :value="view" />
    <input v-if="now" type="hidden" name="now" :value="now" />
    <input type="hidden" name="return_to" :value="returnTo" />
    <slot />
  </form>
</template>
