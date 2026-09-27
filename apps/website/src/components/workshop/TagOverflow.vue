<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger
} from 'reka-ui'
import { ref } from 'vue'

const { tags } = defineProps<{
  tags: readonly { label: string; href: string }[]
}>()
const open = ref(false)

const pill =
  'inline-flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs leading-none whitespace-nowrap'
</script>

<template>
  <HoverCardRoot v-model:open="open" :open-delay="120">
    <HoverCardTrigger
      as="button"
      type="button"
      :aria-label="tags.map((tag) => tag.label).join(', ')"
      :title="tags.map((tag) => tag.label).join(', ')"
      :class="
        cn(pill, 'cursor-pointer text-primary-comfy-canvas/70 tabular-nums')
      "
      data-testid="model-tags-rest"
      @click="open = true"
    >
      +{{ tags.length }}
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        side="top"
        align="end"
        :side-offset="6"
        class="z-50 flex max-w-64 flex-col gap-1.5 rounded-2xl border border-white/10 bg-site-dropdown p-2 shadow-2xl shadow-black/50 outline-none"
        data-testid="model-tags-rest-list"
      >
        <a
          v-for="tag in tags"
          :key="tag.href"
          :href="tag.href"
          :class="
            cn(
              pill,
              'w-full justify-start text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 hover:text-primary-comfy-yellow'
            )
          "
        >
          {{ tag.label }}
        </a>
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>
