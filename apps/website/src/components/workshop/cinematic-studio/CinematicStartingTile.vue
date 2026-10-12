<script setup lang="ts">
import { X } from '@lucide/vue'

import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StudioImage } from '@/lib/workshop/cinematic-studio/take-image'
import type { StartingInput } from './reference-kind'
import { REFERENCE_SLOTS } from './reference-kind'
import { useImagePreview } from './useImagePreview'

const { start, locale = 'en' } = defineProps<{
  start: StartingInput
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

const file = defineModel<StudioImage | undefined>()
const preview = useImagePreview(() => file.value)
</script>

<template>
  <EditorSourceTile
    :kind="start.kind === 'video' ? 'video' : 'image'"
    :src="preview"
    :name="file?.name"
    :add-label="tc(REFERENCE_SLOTS[start.kind].action)"
    :change-label="tc('reshoot.clip.change')"
    :input-test-id="`cinematic-start-${start.kind}`"
    @file="file = $event"
  >
    <button
      v-if="!start.required"
      type="button"
      class="flex items-center gap-1 rounded-full bg-primary-comfy-ink/80 px-2.5 py-1 text-xs text-primary-warm-white hover:text-primary-comfy-yellow"
      :aria-label="`${tc('cinematic.reference.remove')}: ${tc(REFERENCE_SLOTS[start.kind].label)}`"
      @click="file = undefined"
    >
      <X class="size-3" aria-hidden="true" />
      {{ tc('cinematic.reference.remove') }}
    </button>
  </EditorSourceTile>
</template>
