<script setup lang="ts">
import TagOverflow from './TagOverflow.vue'
const { tags, restTags, restCount, baseHref } = defineProps<{
  tags: readonly { label: string; search: string }[]
  restTags: readonly { label: string; href: string }[]
  restCount: number
  baseHref: string
}>()
</script>
<template>
  <ul
    v-if="tags.length > 0"
    class="scrollbar-hide flex items-center gap-2 max-sm:overflow-x-auto sm:flex-wrap lg:justify-end"
    data-testid="model-tags"
  >
    <li v-for="tag in tags" :key="tag.search">
      <a
        :href="`${baseHref}${tag.search}`"
        class="inline-flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs/none whitespace-nowrap text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 hover:text-primary-comfy-yellow"
      >
        {{ tag.label }}
      </a>
    </li>
    <li v-if="restCount > 0">
      <TagOverflow :tags="restTags" />
    </li>
  </ul>
</template>
