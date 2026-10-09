<script setup lang="ts">
import { Link, Plus } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { MAX_COMPARED } from '@/lib/workshop/explorer/compare'

const {
  count,
  titleId,
  locale = 'en'
} = defineProps<{
  count: number
  titleId: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ add: [] }>()

const { copy, copied } = useClipboard({ legacy: true })
function copyLink() {
  void copy(location.href)
}
</script>

<template>
  <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
    <h2
      :id="titleId"
      class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-light text-primary-warm-white sm:text-3xl lg:text-4xl"
    >
      {{ t('workshop.explorer.compare.viewTitle', { count }) }}
      <span class="text-base whitespace-nowrap text-primary-warm-gray">
        {{ t('workshop.explorer.compare.upTo', { max: MAX_COMPARED }) }}
      </span>
    </h2>
    <div class="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        :prepend-icon="Plus"
        data-testid="compare-add"
        @click="emit('add')"
      >
        {{ t('workshop.explorer.compare.add') }}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :prepend-icon="Link"
        data-testid="compare-copy"
        @click="copyLink"
      >
        <span aria-live="polite">
          {{
            copied
              ? t('workshop.explorer.compare.copied')
              : t('workshop.explorer.compare.copyLink')
          }}
        </span>
      </Button>
    </div>
  </header>
</template>
