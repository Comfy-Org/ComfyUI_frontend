<script setup lang="ts">
import { Palette, Plus, UserRound, X } from '@lucide/vue'
import { useObjectUrl } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { kind, locale = 'en' } = defineProps<{
  kind: 'cast' | 'palette' | 'firstFrame' | 'lastFrame'
  locale?: Locale
}>()

const file = defineModel<File | undefined>()
const preview = useObjectUrl(file)
const input = useTemplateRef<HTMLInputElement>('input')
const labels = computed(() => {
  if (kind === 'firstFrame')
    return {
      title: tc('cinematic.video.firstFrame', locale),
      action: tc('cinematic.video.addFirstFrame', locale),
      hint: tc('cinematic.video.uploadFrame', locale)
    }
  if (kind === 'lastFrame')
    return {
      title: tc('cinematic.video.lastFrame', locale),
      action: tc('cinematic.video.addLastFrame', locale),
      hint: tc('cinematic.reference.optional', locale)
    }
  return {
    title: tc(
      kind === 'cast'
        ? 'cinematic.reference.cast'
        : 'cinematic.reference.palette',
      locale
    ),
    action: tc(
      kind === 'cast'
        ? 'cinematic.reference.castAction'
        : 'cinematic.reference.paletteAction',
      locale
    ),
    hint: tc(
      kind === 'cast'
        ? 'cinematic.reference.castHint'
        : 'cinematic.reference.paletteHint',
      locale
    )
  }
})
const accessibleName = computed(() =>
  file.value
    ? `${labels.value.action}: ${file.value.name}`
    : labels.value.action
)

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
    <button
      type="button"
      :class="
        cn(
          'group relative flex h-24 w-full flex-col justify-end overflow-hidden rounded-xl p-2.5 text-left transition-colors',
          file
            ? 'ring-1 ring-transparency-white-t20 ring-inset'
            : 'border border-dashed border-transparency-white-t20 bg-transparency-white-t4 hover:border-primary-warm-white/50'
        )
      "
      :aria-label="accessibleName"
      @click="input?.click()"
    >
      <img
        v-if="preview"
        :src="preview"
        alt=""
        class="absolute inset-0 size-full object-cover"
      />
      <span
        v-if="preview"
        class="absolute inset-0 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/20 to-transparent"
        aria-hidden="true"
      />
      <span
        v-else
        class="absolute top-2.5 left-2.5 grid size-7 place-items-center rounded-lg bg-transparency-white-t8 text-primary-warm-gray group-hover:text-primary-warm-white"
      >
        <UserRound v-if="kind === 'cast'" class="size-3.5" aria-hidden="true" />
        <Palette v-else class="size-3.5" aria-hidden="true" />
      </span>
      <span
        class="relative text-[10px] font-bold tracking-widest text-primary-comfy-canvas uppercase"
      >
        {{ labels.title }}
      </span>
      <span class="relative truncate text-xs text-primary-warm-white">
        {{ file ? file.name : labels.hint }}
      </span>
      <Plus
        v-if="!file"
        class="absolute top-3 right-3 size-4 text-primary-warm-gray"
        aria-hidden="true"
      />
    </button>
    <button
      v-if="file"
      type="button"
      class="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-lg bg-primary-comfy-ink/70 text-primary-warm-white hover:bg-primary-comfy-ink"
      :aria-label="tc('cinematic.reference.remove', locale)"
      @click="file = undefined"
    >
      <X class="size-3.5" aria-hidden="true" />
    </button>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      :data-testid="`cinematic-reference-${kind}`"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="choose"
    />
  </div>
</template>
