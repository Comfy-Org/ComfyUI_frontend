<script setup lang="ts">
import type { HandProductSwap } from '@/composables/useHandProductSwap'
import type { Locale } from '@/i18n/translations'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import EditorTray from '@/components/workshop/app-editor/EditorTray.vue'
import { SWAP_SECTIONS, sectionMeta } from './sections'

const { swap, locale = 'en' } = defineProps<{
  swap: HandProductSwap
  locale?: Locale
}>()

const { tray } = swap
</script>

<template>
  <template v-for="section in SWAP_SECTIONS" :key="section.id">
    <EditorTray
      v-if="tray === section.id"
      :title="hc(section.title, locale)"
      :close-label="hc('swap.close', locale)"
      class="max-w-90"
      @close="tray = undefined"
    >
      <template #actions>
        <span class="text-[11px] text-primary-warm-gray tabular-nums">{{
          sectionMeta(section.id, swap)
        }}</span>
      </template>
      <component :is="section.content" :swap :locale />
    </EditorTray>
  </template>
</template>
