<script setup lang="ts">
import { MousePointer2 } from '@lucide/vue'

import type { MoveTool } from '../../../composables/useMoveAnything'
import type { Locale } from '../../../i18n/translations'
import { mc } from '../../../lib/workshop/move-anything/copy'

const { tool, locale = 'en' } = defineProps<{
  tool: MoveTool
  locale?: Locale
}>()
</script>

<template>
  <p
    class="pointer-events-none absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1.5 rounded-full border border-transparency-white-t8 bg-primary-comfy-ink-light/90 px-2.5 py-1 text-[11px] text-primary-warm-gray shadow-lg shadow-black/30 sm:whitespace-nowrap"
  >
    <MousePointer2 class="size-3" aria-hidden="true" />
    {{ mc(tool === 'add' ? 'move.hint.add' : 'move.hint.move', locale) }}
  </p>
</template>
