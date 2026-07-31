<script setup lang="ts">
import Button from '../ui/button/Button.vue'

const { href, label } = defineProps<{
  href: string
  label: string
}>()
</script>

<template>
  <div class="mt-2 flex justify-center">
    <Button as="a" :href variant="default" size="lg">
      {{ label }}
    </Button>
  </div>
</template>
