<script setup lang="ts">
import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorUploadSlot from '../app-editor/EditorUploadSlot.vue'
import VirtualTryOnRun from './VirtualTryOnRun.vue'
import { TRY_ON_SECTIONS, sectionMeta } from './sections'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { tray, phase, person } = tryOn
</script>

<template>
  <EditorUploadSlot
    :label="vc('tryOn.person.changeLabel', locale)"
    :disabled="phase.kind === 'running'"
    class="flex size-8 shrink-0 items-center justify-center rounded-full bg-transparency-white-t4 transition hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
    @file="tryOn.usePersonFile"
  >
    <img :src="person.url" alt="" class="size-6 rounded-full object-cover" />
  </EditorUploadSlot>
  <EditorChip
    v-for="section in TRY_ON_SECTIONS"
    :key="section.id"
    :label="vc(section.title, locale)"
    :value="sectionMeta(section.id, tryOn, locale)"
    :expanded="tray === section.id"
    :disabled="phase.kind === 'running'"
    compact
    @click="tryOn.toggleTray(section.id)"
  />
  <EditorDivider class="max-sm:hidden" />
  <VirtualTryOnRun :try-on :locale />
</template>
