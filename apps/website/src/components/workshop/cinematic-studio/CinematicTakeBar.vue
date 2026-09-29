<script setup lang="ts">
import { Download } from '@lucide/vue'
import { nextTick } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import { isUnpaid } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  current,
  siblings,
  modelName,
  locale = 'en'
} = defineProps<{
  current: Take
  siblings: readonly Take[]
  modelName: string
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()

const STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1
}

async function onKeydown(event: KeyboardEvent) {
  const step = STEPS[event.key]
  const group = event.currentTarget
  if (!step || !(group instanceof HTMLElement)) return
  event.preventDefault()
  const index = siblings.findIndex((take) => take.id === current.id)
  const next = (index + step + siblings.length) % siblings.length
  emit('select', siblings[next].id)
  await nextTick()
  group.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
}
</script>

<template>
  <div class="flex max-w-full min-w-0 items-center gap-2.5">
    <span class="text-[15px] font-semibold text-primary-warm-white">
      {{ tc('cinematic.stage.shot', locale, { number: current.shot }) }}
    </span>
    <div
      v-if="siblings.length > 1"
      role="radiogroup"
      :aria-label="tc('cinematic.stage.takes', locale)"
      class="flex gap-1"
      @keydown="onKeydown"
    >
      <button
        v-for="take in siblings"
        :key="take.id"
        type="button"
        role="radio"
        :aria-checked="take.id === current.id"
        :tabindex="take.id === current.id ? 0 : -1"
        :aria-description="
          isUnpaid(take) ? tc('cinematic.state.noCredits', locale) : undefined
        "
        :class="
          cn(
            'grid size-6 place-items-center rounded-md text-xs font-medium',
            take.id === current.id
              ? 'bg-primary-warm-white text-primary-comfy-ink'
              : 'text-primary-warm-gray hover:bg-transparency-white-t8',
            isUnpaid(take) &&
              take.id !== current.id &&
              'text-primary-comfy-yellow ring-1 ring-primary-comfy-yellow/35 ring-inset'
          )
        "
        @click="emit('select', take.id)"
      >
        {{ take.letter }}
      </button>
    </div>
    <span class="truncate text-sm text-primary-warm-gray">
      {{ modelName }} · {{ current.aspect }}
    </span>
    <a
      v-if="current.status === 'done'"
      :href="current.output.url"
      :download="current.output.fileName"
      class="grid size-9 place-items-center rounded-lg text-primary-comfy-canvas hover:bg-transparency-white-t8"
      :aria-label="tc('cinematic.stage.download', locale)"
      :title="t('workshop.output.expires', locale)"
    >
      <Download class="size-4" aria-hidden="true" />
    </a>
  </div>
</template>
