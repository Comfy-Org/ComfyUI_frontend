<script setup lang="ts">
import { externalLinks } from '../../config/routes'
import NodeBadge from './NodeBadge.vue'

const { stars } = defineProps<{
  stars: string
}>()
</script>

<template>
  <a
    :href="externalLinks.github"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="`ComfyUI on GitHub — ${stars} stars`"
    class="hidden shrink-0 flex-col items-center lg:flex"
  >
    <span
      class="bg-primary-comfy-yellow block size-8"
      aria-hidden="true"
      style="mask: url('/icons/social/github.svg') center / contain no-repeat"
    />
    <NodeBadge
      :segments="[{ text: stars }]"
      segment-class="px-0 py-0 sm:py-0 lg:py-0"
      text-class="text-[10px] translate-y-0"
      size-class="h-5 w-8 sm:h-5"
    />
  </a>
</template>
