<script setup lang="ts">
import { UserRound, X } from '@lucide/vue'
import { useObjectUrl } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicTooltip from './CinematicTooltip.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const file = defineModel<File | undefined>()
const preview = useObjectUrl(file)
const input = useTemplateRef<HTMLInputElement>('input')
const action = computed(() => {
  const label = tc('cinematic.reference.castAction', locale)
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
    <CinematicTooltip
      :text="file?.name ?? tc('cinematic.reference.cast', locale)"
    >
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
        <img
          v-if="preview"
          :src="preview"
          alt=""
          class="size-full object-cover"
        />
        <UserRound v-else class="size-4" aria-hidden="true" />
      </button>
    </CinematicTooltip>
    <button
      v-if="file"
      type="button"
      class="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary-warm-white text-primary-comfy-ink hover:bg-primary-comfy-yellow"
      :aria-label="tc('cinematic.reference.remove', locale)"
      @click="file = undefined"
    >
      <X class="size-2.5" aria-hidden="true" />
    </button>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      data-testid="cinematic-reference-cast"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="choose"
    />
  </div>
</template>
