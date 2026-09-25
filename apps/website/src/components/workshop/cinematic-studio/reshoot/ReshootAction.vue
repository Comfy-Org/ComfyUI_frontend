<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { DepthState } from '../../../../composables/useReshootDemo'
import type { ReshootCopyKey } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const {
  depth,
  rendering,
  wide = false,
  locale = 'en'
} = defineProps<{
  depth: DepthState
  rendering: boolean
  wide?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ analyze: []; generate: []; cancel: [] }>()

const label = computed<ReshootCopyKey>(() => {
  if (depth === 'analyzing') return 'reshoot.analyzing'
  return depth === 'ready' ? 'reshoot.generate' : 'reshoot.analyze'
})

function run() {
  if (depth === 'ready') emit('generate')
  else emit('analyze')
}
</script>

<template>
  <Button
    v-if="rendering"
    variant="outline"
    :class="wide ? 'w-full rounded-full' : 'shrink-0 rounded-full px-6'"
    @click="emit('cancel')"
  >
    {{ rc('reshoot.cancel', locale) }}
  </Button>
  <Button
    v-else
    :disabled="depth === 'analyzing'"
    :class="wide ? 'w-full rounded-full' : 'shrink-0 rounded-full px-6'"
    data-testid="reshoot-action"
    @click="run"
  >
    {{ rc(label, locale) }}
  </Button>
</template>
