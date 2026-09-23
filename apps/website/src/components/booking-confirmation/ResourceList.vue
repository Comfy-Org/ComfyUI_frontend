<script setup lang="ts">
const { resources } = defineProps<{
  resources: { label: string; href: string; display: string }[]
}>()
</script>

<template>
  <ul class="flex flex-col gap-3 text-base font-light lg:text-lg">
    <li v-for="resource in resources" :key="resource.href">
      <span class="text-primary-comfy-canvas">{{ resource.label }}</span>
      <span class="text-primary-warm-gray"> — </span>
      <a
        :href="resource.href"
        class="text-primary-comfy-yellow underline underline-offset-4 hover:no-underline"
      >
        {{ resource.display }}
      </a>
    </li>
  </ul>
</template>
