<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { DepthState } from '@/composables/useReshoot'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type { Locale } from '@/i18n/translations'
import CinematicGenerateAction from '@/components/workshop/cinematic-studio/CinematicGenerateAction.vue'

const {
  depth,
  error,
  gate,
  canGenerate,
  priceNote,
  workspaceName,
  locale = 'en'
} = defineProps<{
  depth: DepthState
  /** The last failed depth read, said above its Try again button. */
  error?: string
  gate: StudioGate
  canGenerate: boolean
  priceNote?: string
  workspaceName?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ analyze: []; generate: [] }>()

const ready = computed(() => depth === 'ready')
const analyzing = computed(() => depth === 'analyzing')
const failed = computed(() => !!error && !ready.value && !analyzing.value)
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- The scene is read on its own when a clip is picked; a failed
         read waits here to be tried again. -->
    <div
      v-if="failed"
      role="alert"
      class="flex items-center gap-3 rounded-xl bg-transparency-white-t8 py-2 pr-2 pl-3"
    >
      <p
        class="min-w-0 flex-1 text-[11px] wrap-break-word text-primary-warm-white"
      >
        {{ t('reshoot.failed') }}: {{ error }}
      </p>
      <Button
        size="sm"
        variant="outline"
        class="shrink-0 rounded-full"
        data-testid="reshoot-analyze"
        @click="emit('analyze')"
      >
        {{ t('reshoot.tryAgain') }}
      </Button>
    </div>
    <p
      v-else-if="ready || analyzing"
      class="text-center text-[11px] text-primary-warm-gray"
    >
      {{ t(ready ? 'reshoot.generate.note' : 'reshoot.generate.wait') }}
    </p>
    <p
      v-if="priceNote"
      class="text-center text-xs text-primary-comfy-canvas"
      data-testid="reshoot-price"
    >
      {{ priceNote }}
    </p>
    <Button
      v-if="gate === 'ready'"
      size="lg"
      class="rounded-full"
      :disabled="!canGenerate"
      data-testid="reshoot-action"
      @click="emit('generate')"
    >
      {{ t('reshoot.generate.label') }}
    </Button>
    <CinematicGenerateAction
      v-else
      :gate
      :workspace-name
      :rendering="false"
      :can-generate="false"
      wide
      :locale
    />
  </div>
</template>
