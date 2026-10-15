<script setup lang="ts">
import { AppWindow, Box, Workflow } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { MediaKind } from '@/lib/cms/editor'

/** A stand-in for the Hub's listing card, so editors see what visitors get. */
const { kind, title, description, byline, media, badge, emptyLabel } =
  defineProps<{
    kind: 'MODEL' | 'WORKFLOW' | 'APP'
    title: string
    description?: string
    byline?: string
    media?: { url: string; kind: MediaKind }
    badge?: { label: string; tone: 'warning' | 'muted' }
    /** Shown in place of the image when there is none. */
    emptyLabel: string
  }>()
const placeholder = { MODEL: Box, WORKFLOW: Workflow, APP: AppWindow }
</script>

<template>
  <article
    class="grid w-full max-w-xs overflow-hidden rounded-xl border border-admin-line bg-admin-page"
  >
    <div
      class="relative grid aspect-4/3 place-items-center overflow-hidden bg-admin-raised text-admin-subtle"
    >
      <video
        v-if="media?.url && media.kind === 'video'"
        :src="media.url"
        muted
        playsinline
        preload="metadata"
        class="size-full object-cover"
      />
      <img
        v-else-if="media?.url"
        :src="media.url"
        alt=""
        class="size-full object-cover"
      />
      <span v-else class="grid justify-items-center gap-1.5 text-xs">
        <component :is="placeholder[kind]" class="size-6" aria-hidden="true" />
        {{ emptyLabel }}
      </span>
      <span
        v-if="badge"
        :class="
          cn(
            'absolute top-2 left-2 rounded-full border bg-admin-page/90 px-2 py-0.5 text-xs font-medium',
            badge.tone === 'warning'
              ? 'border-admin-warning/40 text-admin-warning'
              : 'border-admin-line text-admin-muted'
          )
        "
      >
        {{ badge.label }}
      </span>
    </div>
    <div class="grid gap-1 p-3">
      <p class="truncate text-sm font-medium">{{ title }}</p>
      <p v-if="description" class="line-clamp-2 text-xs text-admin-muted">
        {{ description }}
      </p>
      <p v-if="byline" class="truncate text-xs text-admin-subtle">
        {{ byline }}
      </p>
    </div>
  </article>
</template>
