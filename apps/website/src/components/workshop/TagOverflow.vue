<script setup lang="ts">
import { ref } from 'vue'

import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger
} from 'reka-ui'

// The hero's +N: the same hover card the catalogue's TagRow gives its
// overflow, for tags that carry their own hrefs. A native title tooltip is
// what this replaces.
const { tags } = defineProps<{
  tags: readonly { label: string; href: string }[]
}>()

// HoverCard ignores touch pointers by design, so a tap toggles it by hand -
// otherwise the overflow tags are unreachable on phones.
const open = ref(false)

const pill =
  'inline-flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs leading-none whitespace-nowrap text-primary-comfy-canvas'
</script>

<template>
  <HoverCardRoot v-model:open="open" :open-delay="120">
    <HoverCardTrigger
      as="button"
      type="button"
      :aria-label="tags.map((tag) => tag.label).join(', ')"
      :class="`${pill} cursor-default text-primary-comfy-canvas/70 tabular-nums`"
      data-testid="model-tags-rest"
      @click.prevent="open = !open"
    >
      +{{ tags.length }}
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        side="top"
        align="end"
        :side-offset="6"
        class="bg-site-dropdown z-50 flex max-w-64 flex-col gap-1.5 rounded-2xl border border-white/10 p-2 shadow-2xl shadow-black/50"
        data-testid="model-tags-rest-list"
      >
        <a
          v-for="tag in tags"
          :key="tag.href"
          :href="tag.href"
          :class="`${pill} hover:text-primary-comfy-yellow w-full justify-start transition-colors hover:bg-transparency-white-t20`"
        >
          {{ tag.label }}
        </a>
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>
