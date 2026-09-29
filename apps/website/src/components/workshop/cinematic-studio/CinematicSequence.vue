<script setup lang="ts">
import type { Component } from 'vue'
import {
  CircleAlert,
  CircleStop,
  Coins,
  LoaderCircle,
  ShieldAlert
} from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Take,
  TakeKind
} from '../../../lib/workshop/cinematic-studio/reel'
import { takeKind } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { aspectStyle } from './aspect-style'

const {
  takes,
  currentId,
  locale = 'en'
} = defineProps<{
  takes: readonly Take[]
  currentId?: string
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()

interface ThumbLook {
  readonly icon: Component
  readonly iconClass: string
  readonly frame?: string
}

const LOOK: Readonly<Record<Exclude<TakeKind, 'done'>, ThumbLook>> = {
  rendering: {
    icon: LoaderCircle,
    iconClass: 'text-primary-comfy-yellow motion-safe:animate-spin'
  },
  cancelled: { icon: CircleStop, iconClass: 'text-primary-comfy-canvas' },
  unpaid: {
    icon: Coins,
    iconClass: 'text-primary-comfy-yellow',
    frame:
      'bg-primary-comfy-yellow/10 ring-1 ring-primary-comfy-yellow/35 ring-inset'
  },
  blocked: {
    icon: ShieldAlert,
    iconClass: 'text-primary-comfy-orange',
    frame:
      'bg-primary-comfy-orange/10 ring-1 ring-primary-comfy-orange/35 ring-inset'
  },
  failed: {
    icon: CircleAlert,
    iconClass: 'text-primary-comfy-red',
    frame: 'bg-primary-comfy-red/10 ring-1 ring-primary-comfy-red/35 ring-inset'
  }
}

const thumbs = computed(() =>
  takes.map((take, index) => {
    const kind = takeKind(take)
    const look = kind === 'done' ? undefined : LOOK[kind]
    const current = take.id === currentId
    return {
      take,
      look,
      current,
      label: tc('cinematic.stage.takeName', locale, {
        shot: take.shot,
        take: take.letter
      }),
      description:
        kind === 'unpaid' ? tc('cinematic.state.noCredits', locale) : undefined,
      class: cn(
        'grid h-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 bg-transparency-white-t4 transition-opacity focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none focus-visible:ring-inset',
        index > 0 && takes[index - 1].shot !== take.shot && 'ml-2',
        look?.frame,
        current
          ? 'border-primary-comfy-yellow'
          : 'border-transparent opacity-60 hover:opacity-100'
      )
    }
  })
)
</script>

<template>
  <nav
    :aria-label="tc('cinematic.stage.sequence', locale)"
    class="flex max-w-full items-center gap-2 overflow-x-auto"
  >
    <button
      v-for="thumb in thumbs"
      :key="thumb.take.id"
      type="button"
      :aria-current="thumb.current"
      :aria-label="thumb.label"
      :aria-description="thumb.description"
      :class="thumb.class"
      :style="aspectStyle(thumb.take.aspect)"
      @click="emit('select', thumb.take.id)"
    >
      <video
        v-if="
          thumb.take.status === 'done' && thumb.take.output.kind === 'video'
        "
        :src="thumb.take.output.url"
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
        :class="
          cn('size-full object-cover', thumb.take.output.nsfw && 'blur-md')
        "
      />
      <img
        v-else-if="thumb.take.status === 'done'"
        :src="thumb.take.output.url"
        alt=""
        :class="
          cn('size-full object-cover', thumb.take.output.nsfw && 'blur-md')
        "
      />
      <component
        :is="thumb.look.icon"
        v-else-if="thumb.look"
        :class="cn('size-4', thumb.look.iconClass)"
        aria-hidden="true"
      />
    </button>
  </nav>
</template>
