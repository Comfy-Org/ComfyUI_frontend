<script setup lang="ts">
import type { VirtualTryOn } from '@/composables/useVirtualTryOn'
import type { Locale } from '@/i18n/translations'
import { vc } from '@/lib/workshop/virtual-try-on/copy'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { person } = tryOn
</script>

<template>
  <EditorSourceTile
    kind="image"
    :src="person?.url"
    :caption="person?.name"
    :add-label="vc('tryOn.person.upload', locale)"
    :hint="vc('tryOn.person.hint', locale)"
    :remove-label="vc('tryOn.person.remove', locale)"
    input-test-id="try-on-person-input"
    class="mt-2 mb-3"
    data-testid="try-on-person-row"
    @file="tryOn.usePersonFile"
    @remove="tryOn.removePerson"
  />
</template>
