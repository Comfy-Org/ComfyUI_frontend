<script setup lang="ts">
import TypeformEmbed from './TypeformEmbed.vue'

const { typeformId, hiddenFields } = defineProps<{
  typeformId: string
  hiddenFields?: string
}>()
</script>

<template>
  <div class="h-[70vh] min-h-96">
    <TypeformEmbed :typeform-id :hidden-fields redirect-target="_self" />
  </div>
</template>
