<script setup lang="ts">
import { ref, onMounted, useTemplateRef, nextTick } from 'vue'
import { badgeVariants } from '../ui/badge'

interface BadgeItem {
  label: string
  href: string
}

defineProps<{
  items: BadgeItem[]
}>()

const expanded = ref(false)
const needsCollapse = ref(false)
const contentRef = useTemplateRef<HTMLElement>('content')

// ~2 rows of h-6 badges with gap-2 (8px): 24 + 8 + 24 = 56px
const COLLAPSED_HEIGHT = 56

onMounted(async () => {
  await nextTick()
  if (contentRef.value) {
    needsCollapse.value = contentRef.value.scrollHeight > COLLAPSED_HEIGHT + 4
  }
})
</script>

<template>
  <div>
    <div
      ref="content"
      class="flex flex-wrap gap-2 overflow-hidden transition-[max-height] duration-200"
      :style="
        needsCollapse && !expanded
          ? { maxHeight: COLLAPSED_HEIGHT + 'px' }
          : { maxHeight: contentRef?.scrollHeight + 'px' }
      "
    >
      <a
        v-for="item in items"
        :key="item.label"
        :href="item.href"
        :class="badgeVariants({ variant: 'hub-pill' })"
        data-astro-prefetch
      >
        {{ item.label }}
      </a>
    </div>
    <button
      v-if="needsCollapse"
      type="button"
      class="text-content mt-2 flex h-8 w-full items-center justify-between rounded-full px-4 text-xs transition-colors hover:bg-white/5"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'See less' : 'See more' }}
      <svg
        class="size-4 transition-transform duration-200"
        :class="{ 'rotate-90': !expanded }"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</template>
