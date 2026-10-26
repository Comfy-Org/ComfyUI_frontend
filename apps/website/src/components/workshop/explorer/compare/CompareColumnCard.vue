<script setup lang="ts">
import { X } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import WorkshopCardMedia from '@/components/workshop/WorkshopCardMedia.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { accessFor } from '@/lib/workshop/explorer/model-access'

const {
  model,
  removable = false,
  locale = 'en'
} = defineProps<{
  model: WorkshopModel
  removable?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <div class="relative flex flex-col gap-3 rounded-3xl bg-hub-surface p-2 pb-4">
    <span
      class="relative block aspect-4/3 w-full overflow-hidden rounded-2xl bg-hub-surface"
      data-testid="compare-thumbnail"
    >
      <WorkshopCardMedia :model />
    </span>
    <IconButton
      v-if="removable"
      type="button"
      size="sm"
      class="absolute top-4 right-4 z-10 bg-primary-comfy-ink/60 backdrop-blur-md"
      :aria-label="t('workshop.explorer.compare.remove', { name: model.name })"
      data-testid="compare-remove"
      @click="emit('remove')"
    >
      <X class="size-3.5" aria-hidden="true" />
    </IconButton>
    <div class="flex flex-col gap-1 px-2">
      <span class="text-base font-medium text-primary-warm-white">
        {{ model.name }}
      </span>
      <span class="text-xs text-primary-warm-gray">
        {{ model.provider ?? '—' }}
      </span>
    </div>
    <div class="flex flex-wrap gap-2 px-2">
      <Button
        v-if="model.href"
        :href="model.href"
        size="sm"
        :aria-label="t('workshop.explorer.compare.try', { name: model.name })"
        data-testid="compare-model-link"
      >
        {{ t('workshop.explorer.compare.tryShort') }}
      </Button>
      <Button
        v-if="model.href && accessFor(model).includes('api')"
        :href="`${model.href}#api`"
        variant="outline"
        size="sm"
        :aria-label="
          t('workshop.explorer.compare.apiFor', {
            name: model.name
          })
        "
        data-testid="compare-api-link"
      >
        {{ t('workshop.explorer.compare.api') }}
      </Button>
    </div>
  </div>
</template>
