<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { filtered, locale = 'en' } = defineProps<{
  filtered: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ clear: [] }>()
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-transparency-white-t8 px-6 py-16 text-center"
    data-testid="workshop-empty"
  >
    <p class="text-lg font-semibold text-primary-comfy-canvas">
      {{ t('workshop.empty.heading') }}
    </p>
    <p class="text-sm text-primary-warm-gray">
      {{ t('workshop.empty.body') }}
    </p>
    <Button v-if="filtered" variant="outline" size="sm" @click="$emit('clear')">
      {{ t('workshop.empty.clear') }}
    </Button>
  </div>
</template>
