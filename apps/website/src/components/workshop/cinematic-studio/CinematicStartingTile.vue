<script setup lang="ts">
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
    :caption="file?.name"
    :add-label="tc(REFERENCE_SLOTS[start.kind].action)"
    :remove-label="`${tc('cinematic.reference.remove')}: ${tc(REFERENCE_SLOTS[start.kind].label)}`"
    :input-test-id="`cinematic-start-${start.kind}`"
    @file="file = $event"
    @remove="file = undefined"
  />
</template>
