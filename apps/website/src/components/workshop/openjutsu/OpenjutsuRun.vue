<script setup lang="ts">
import { computed } from 'vue'

import EditorRun from '@/components/workshop/app-editor/EditorRun.vue'
import CinematicGenerateAction from '@/components/workshop/cinematic-studio/CinematicGenerateAction.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type { MissingInput } from '@/lib/workshop/openjutsu/swap-rules'

/**
 * The panel's pinned footer: Swap with what it costs once the account can
 * run, or what the account has to do first, then the line under it.
 */
const {
  gate,
  missing,
  canGenerate,
  rendering,
  priceNote,
  workspaceName,
  locale = 'en'
} = defineProps<{
  gate: StudioGate
  missing?: MissingInput
  canGenerate: boolean
  rendering: boolean
  /** The quote for the next run: its price, or the free runs left. */
  priceNote?: string
  workspaceName?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ generate: []; cancel: [] }>()

const NEEDS = {
  video: 'openjutsu.needs.video',
  character: 'openjutsu.needs.character',
  target: 'openjutsu.needs.target'
} as const

/** A run the quote refuses says why on the button, in place of its label. */
const blocked = computed(() =>
  gate === 'ready' && !missing && !canGenerate && !rendering
    ? priceNote
    : undefined
)
const footnote = computed(() =>
  rendering ? t('openjutsu.generate.busy') : t('openjutsu.generate.note')
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <EditorRun
      v-if="gate === 'ready' || rendering"
      :label="t('openjutsu.run')"
      :cancel-label="t('reshoot.cancel')"
      :running="rendering"
      :disabled="!canGenerate"
      :missing="missing ? t(NEEDS[missing]) : blocked"
      block
      data-testid="openjutsu-action"
      @run="emit('generate')"
      @cancel="emit('cancel')"
    />
    <CinematicGenerateAction
      v-else
      :gate
      :workspace-name
      :rendering="false"
      :can-generate="false"
      :show-credits="false"
      wide
      :locale
    />
    <p
      v-if="priceNote && !blocked"
      class="text-center text-xs font-medium text-primary-warm-white"
      data-testid="openjutsu-price"
    >
      {{ priceNote }}
    </p>
    <p
      class="text-center text-[11px] text-primary-warm-gray"
      data-testid="openjutsu-footnote"
    >
      {{ footnote }}
    </p>
  </div>
</template>
