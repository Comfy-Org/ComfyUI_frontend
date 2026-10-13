<script setup lang="ts">
import { computed } from 'vue'

import EditorRun from '@/components/workshop/app-editor/EditorRun.vue'
import CinematicGenerateAction from '@/components/workshop/cinematic-studio/CinematicGenerateAction.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type { MissingInput } from '@/lib/workshop/openjutsu/swap-rules'

/**
 * The panel's pinned footer: the kit's run button, saying why it cannot swap
 * when it cannot, or what the account has to do first, then the line under it.
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

/** Gates the account can act on keep their own buttons: sign in, buy, switch. */
const accountGate = computed(
  () =>
    !rendering &&
    (gate === 'signedOut' || gate === 'noCredits' || gate === 'memberNoCredits')
)

/** Why the button cannot swap, said on it in place of its label. */
const blocked = computed(() => {
  if (rendering || gate === 'unavailable') return undefined
  if (gate === 'pending') return t('cinematic.output.checking')
  if (missing) return t(NEEDS[missing])
  return canGenerate ? undefined : priceNote
})
const footnote = computed(() => {
  if (rendering) return t('openjutsu.generate.busy')
  if (gate === 'unavailable') return t('openjutsu.unavailable')
  return t('openjutsu.generate.note')
})
const showPrice = computed(
  () => gate === 'ready' && !!priceNote && blocked.value !== priceNote
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <CinematicGenerateAction
      v-if="accountGate"
      :gate
      :workspace-name
      :rendering="false"
      :can-generate="false"
      :show-credits="false"
      wide
      :locale
    />
    <EditorRun
      v-else
      :label="t('openjutsu.run')"
      :cancel-label="t('reshoot.cancel')"
      :running="rendering"
      :disabled="!canGenerate"
      :missing="blocked"
      block
      data-testid="openjutsu-action"
      @run="emit('generate')"
      @cancel="emit('cancel')"
    />
    <p
      v-if="showPrice"
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
