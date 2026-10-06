<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'

import Button from '@/components/ui/button/Button.vue'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type { Locale } from '@/i18n/translations'
import CinematicGenerateAction from '@/components/workshop/cinematic-studio/CinematicGenerateAction.vue'

const {
  gate,
  ready,
  rendering,
  canGenerate,
  priceNote,
  workspaceName,
  locale = 'en'
} = defineProps<{
  gate: StudioGate
  ready: boolean
  rendering: boolean
  canGenerate: boolean
  priceNote?: string
  workspaceName?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ generate: []; cancel: [] }>()
</script>

<template>
  <footer
    class="mt-auto flex flex-col gap-2.5 rounded-b-2xl border-t border-transparency-white-t8 p-3 text-center"
  >
    <p
      v-if="priceNote"
      class="text-xs text-primary-comfy-canvas"
      data-testid="reshoot-price"
    >
      {{ priceNote }}
    </p>
    <CinematicGenerateAction
      v-if="gate !== 'ready'"
      :gate
      :workspace-name
      :rendering="false"
      :can-generate="false"
      wide
      :locale
    />
    <Button
      v-else-if="rendering"
      variant="outline"
      class="w-full rounded-full px-5"
      data-testid="reshoot-cancel"
      @click="emit('cancel')"
    >
      {{ t('reshoot.cancel') }}
    </Button>
    <Button
      v-else
      class="w-full rounded-full px-5"
      :disabled="!canGenerate"
      data-testid="reshoot-action"
      @click="emit('generate')"
    >
      {{ t('reshoot.generate.label') }}
    </Button>
    <p
      v-if="gate === 'ready' && !rendering"
      class="text-xs text-primary-warm-gray"
    >
      {{ t(ready ? 'reshoot.generate.note' : 'reshoot.generate.wait') }}
    </p>
  </footer>
</template>
