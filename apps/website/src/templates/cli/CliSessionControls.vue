<script setup lang="ts">
import { computed } from 'vue'
import BrandButton from '@/components/common/BrandButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const {
  locale = 'en',
  reduced,
  paused
} = defineProps<{
  locale?: Locale
  reduced: boolean
  paused: boolean
}>()
const { t } = translationsFor(locale)
const emit = defineEmits<{ toggle: []; replay: [] }>()
const statusLabel = computed(() =>
  t(reduced ? 'cli.session.reducedStatus' : 'cli.session.recordedStatus')
)
const playbackLabel = computed(() =>
  t(paused ? 'cli.session.resume' : 'cli.session.pause')
)
</script>
<template>
  <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
    <p class="text-xs text-smoke-700">
      {{ statusLabel }}
    </p>
    <div class="flex gap-2">
      <BrandButton
        v-if="!reduced"
        class="uppercase"
        variant="outline"
        :aria-pressed="paused"
        @click="emit('toggle')"
        >{{ playbackLabel }}</BrandButton
      >
      <BrandButton
        v-if="!reduced"
        class="uppercase"
        variant="outline"
        @click="emit('replay')"
        >{{ t('cli.session.replay') }}</BrandButton
      >
    </div>
  </div>
</template>
