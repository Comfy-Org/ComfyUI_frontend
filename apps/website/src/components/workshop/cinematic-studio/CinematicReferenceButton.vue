<script setup lang="ts">
import { ChevronFirst, ChevronLast, Film, UserRound, X } from '@lucide/vue'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StudioImage } from '@/lib/workshop/cinematic-studio/take-image'
import CinematicTooltip from './CinematicTooltip.vue'
import type { ReferenceKind } from './reference-kind'
import { REFERENCE_SLOTS } from './reference-kind'
import { useImagePreview } from './useImagePreview'

const ICONS: Readonly<Record<ReferenceKind, typeof UserRound>> = {
  cast: UserRound,
  firstFrame: ChevronFirst,
  lastFrame: ChevronLast,
  video: Film
}

const { kind = 'cast', locale = 'en' } = defineProps<{
  kind?: ReferenceKind
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

const file = defineModel<StudioImage | undefined>()
const preview = useImagePreview(() => file.value)
const input = useTemplateRef<HTMLInputElement>('input')
const slot = computed(() => REFERENCE_SLOTS[kind])
const action = computed(() => {
  const label = tc(slot.value.action)
  return file.value ? `${label}: ${file.value.name}` : label
})

function choose(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const [picked] = target.files ?? []
  if (picked) file.value = picked
  target.value = ''
}
</script>

<template>
  <div class="relative">
    <CinematicTooltip :text="file?.name ?? tc(slot.label)">
      <button
        type="button"
        :aria-label="action"
        :class="
          cn(
            'grid size-9 place-items-center overflow-hidden rounded-xl border border-dashed border-transparency-white-t20 text-primary-comfy-canvas outline-none hover:border-primary-warm-white/50 hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
            preview && 'border-solid'
          )
        "
        @click="input?.click()"
      >
        <template v-if="preview">
          <video
            v-if="kind === 'video'"
            :src="preview"
            muted
            playsinline
            class="size-full object-cover"
          />
          <img v-else :src="preview" alt="" class="size-full object-cover" />
        </template>
        <component :is="ICONS[kind]" v-else class="size-4" aria-hidden="true" />
      </button>
    </CinematicTooltip>
    <button
      v-if="file"
      type="button"
      class="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary-warm-white text-primary-comfy-ink hover:bg-primary-comfy-yellow"
      :aria-label="`${tc('cinematic.reference.remove')}: ${tc(slot.label)}`"
      @click="file = undefined"
    >
      <X class="size-2.5" aria-hidden="true" />
    </button>
    <input
      ref="input"
      type="file"
      :accept="slot.accept"
      :data-testid="`cinematic-reference-${kind}`"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="choose"
    />
  </div>
</template>
