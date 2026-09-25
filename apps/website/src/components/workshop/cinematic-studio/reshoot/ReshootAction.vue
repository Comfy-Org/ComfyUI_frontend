<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { DepthState } from '../../../../composables/useReshootDemo'
import type { ReshootCopyKey } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const {
  step,
  depth,
  rendering,
  wide = false,
  locale = 'en'
} = defineProps<{
  step: 1 | 2
  depth: DepthState
  rendering: boolean
  wide?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ prepare: []; generate: []; cancel: [] }>()

const label = computed<ReshootCopyKey>(() => {
  if (step === 2) return 'reshoot.generate'
  if (depth === 'analyzing') return 'reshoot.analyzing'
  return depth === 'ready' ? 'reshoot.continue' : 'reshoot.analyze'
})
const shape = computed(() =>
  wide ? 'w-full rounded-full' : 'shrink-0 rounded-full px-6'
)
</script>

<template>
  <Button
    v-if="rendering"
    variant="outline"
    :class="shape"
    @click="emit('cancel')"
  >
    {{ rc('reshoot.cancel', locale) }}
  </Button>
  <Button
    v-else
    :disabled="depth === 'analyzing'"
    :class="shape"
    data-testid="reshoot-action"
    @click="step === 2 ? emit('generate') : emit('prepare')"
  >
    <span class="inline-flex items-center gap-2">
      {{ rc(label, locale) }}
      <ArrowRight v-if="step === 1" class="size-4" aria-hidden="true" />
    </span>
  </Button>
</template>
