<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger
} from 'reka-ui'

const { tags } = defineProps<{
  tags: readonly { label: string; href: string }[]
}>()

const pill =
  'inline-flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs leading-none whitespace-nowrap'
</script>

<template>
  <HoverCardRoot :open-delay="120">
    <HoverCardTrigger
      :aria-label="tags.map((tag) => tag.label).join(', ')"
      :title="tags.map((tag) => tag.label).join(', ')"
      :class="
        cn(pill, 'cursor-pointer text-primary-comfy-canvas/70 tabular-nums')
      "
      data-testid="model-tags-rest"
    >
      +{{ tags.length }}
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        side="top"
        align="end"
        :side-offset="6"
        class="bg-site-dropdown z-50 flex max-w-64 flex-col gap-1.5 rounded-2xl border border-white/10 p-2 shadow-2xl shadow-black/50 outline-none"
        data-testid="model-tags-rest-list"
      >
        <a
          v-for="tag in tags"
          :key="tag.href"
          :href="tag.href"
          :class="
            cn(
              pill,
              'hover:text-primary-comfy-yellow w-full justify-start text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20'
            )
          "
        >
          {{ tag.label }}
        </a>
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>
