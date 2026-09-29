<script setup lang="ts">
import { Plus, X } from '@lucide/vue'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { StudioImage } from '../../../lib/workshop/cinematic-studio/take-image'
import type { ReferenceKind } from './reference-kind'
import { REFERENCE_SLOTS } from './reference-kind'
import { useImagePreview } from './useImagePreview'

const { kind, locale = 'en' } = defineProps<{
  kind: ReferenceKind
  locale?: Locale
}>()

const file = defineModel<StudioImage | undefined>()
const preview = useImagePreview(() => file.value)
const input = useTemplateRef<HTMLInputElement>('input')

const label = computed(() => tc(REFERENCE_SLOTS[kind].label, locale))
const accessibleName = computed(() => {
  const action = tc(REFERENCE_SLOTS[kind].action, locale)
  return file.value ? `${action}: ${file.value.name}` : action
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
    <button
      type="button"
      :class="
        cn(
          'group relative flex w-full overflow-hidden rounded-xl transition-colors',
          file
            ? 'h-20 flex-col justify-end p-2.5 text-left ring-1 ring-transparency-white-t20 ring-inset'
            : 'h-11 items-center justify-center gap-1.5 border border-dashed border-transparency-white-t20 text-sm text-primary-comfy-canvas hover:border-primary-warm-white/50 hover:bg-transparency-white-t4 hover:text-primary-warm-white'
        )
      "
      :aria-label="accessibleName"
      @click="input?.click()"
    >
      <template v-if="preview">
        <video
          v-if="kind === 'video'"
          :src="preview"
          muted
          playsinline
          class="absolute inset-0 size-full object-cover"
        />
        <img
          v-else
          :src="preview"
          alt=""
          class="absolute inset-0 size-full object-cover"
        />
        <span
          class="absolute inset-0 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/20 to-transparent"
          aria-hidden="true"
        />
        <span
          class="relative text-[10px] font-bold tracking-widest text-primary-comfy-canvas uppercase"
        >
          {{ label }}
        </span>
        <span class="relative truncate text-xs text-primary-warm-white">
          {{ file?.name }}
        </span>
      </template>
      <template v-else>
        <Plus class="size-4 shrink-0" aria-hidden="true" />
        {{ label }}
      </template>
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
      :accept="REFERENCE_SLOTS[kind].accept"
      :data-testid="`cinematic-reference-${kind}`"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="choose"
    />
  </div>
</template>
