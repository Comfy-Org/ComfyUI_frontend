<script setup lang="ts">
import { Plus, X } from '@lucide/vue'
import { useObjectUrl } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const file = defineModel<File | undefined>()
const preview = useObjectUrl(file)
const input = useTemplateRef<HTMLInputElement>('input')
const accessibleName = computed(() => {
  const action = tc('cinematic.reference.castAction', locale)
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
  <div
    class="flex h-7 max-w-44 min-w-0 items-center rounded-full bg-transparency-white-t8 text-xs text-primary-comfy-canvas"
    data-testid="cinematic-character-chip"
  >
    <button
      type="button"
      class="flex h-full min-w-0 items-center gap-1.5 rounded-full pr-3 pl-1 outline-none hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50"
      :aria-label="accessibleName"
      @click="input?.click()"
    >
      <img
        v-if="preview"
        :src="preview"
        alt=""
        class="size-5 shrink-0 rounded-full object-cover"
      />
      <Plus v-else class="ml-1 size-3.5 shrink-0" aria-hidden="true" />
      <span class="truncate">
        {{ file?.name ?? tc('cinematic.reference.cast', locale) }}
      </span>
    </button>
    <button
      v-if="file"
      type="button"
      class="-ml-2 grid size-7 shrink-0 place-items-center rounded-full text-primary-warm-gray hover:text-primary-warm-white"
      :aria-label="tc('cinematic.reference.remove', locale)"
      @click="file = undefined"
    >
      <X class="size-3" aria-hidden="true" />
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
