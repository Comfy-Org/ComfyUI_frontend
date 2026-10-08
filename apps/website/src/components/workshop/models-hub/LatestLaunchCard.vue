<script setup lang="ts">
import { computed } from 'vue'

import BrandButton from '@/components/common/BrandButton.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import WorkshopCardMedia from '@/components/workshop/WorkshopCardMedia.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { accessBadgeKey, accessFor } from '@/lib/workshop/explorer/model-access'
import { taskLabelFor } from '@/lib/workshop/task-label'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopModel
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const taskLabel = computed(() => taskLabelFor(model, locale))
const access = computed(() => accessFor(model)[0])
</script>

<template>
  <div
    class="group relative h-70 overflow-hidden rounded-3xl bg-hub-surface sm:h-85"
  >
    <div class="absolute inset-0 *:object-[50%_35%]">
      <WorkshopCardMedia :model />
    </div>
    <div
      class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/40 via-50% to-black/0 to-85% sm:via-30% sm:to-55%"
      aria-hidden="true"
    />
    <Badge
      variant="accent"
      class="pointer-events-none absolute top-4 left-4 z-10"
    >
      {{ t('workshop.modelsHub.latestLaunch') }}
    </Badge>
    <div
      class="absolute inset-x-5 bottom-5 flex flex-col items-start gap-4 sm:inset-x-7 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="flex w-full min-w-0 flex-col gap-2">
        <h2
          class="text-xl font-medium text-primary-warm-white text-shadow-lg text-shadow-primary-comfy-ink/60 sm:text-2xl"
        >
          <a
            :href="model.href"
            class="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
            data-testid="models-hub-latest-title"
          >
            {{ model.name }}
          </a>
        </h2>
        <p
          v-if="model.summary"
          class="truncate text-sm font-light text-content-secondary text-shadow-lg text-shadow-primary-comfy-ink/60"
        >
          {{ model.summary }}
        </p>
        <div class="mt-1 flex items-center gap-1.5">
          <Badge variant="subtle">{{ taskLabel }}</Badge>
          <Badge v-if="access" variant="subtle">
            {{ t(accessBadgeKey[access]) }}
          </Badge>
        </div>
      </div>
      <BrandButton
        v-if="model.href"
        :href="model.href"
        variant="outline-light"
        size="nav"
        class="shrink-0 uppercase"
        :aria-label="t('workshop.explorer.compare.try', { name: model.name })"
        data-testid="models-hub-latest-try"
      >
        {{ t('workshop.explorer.compare.tryShort') }}
      </BrandButton>
    </div>
  </div>
</template>
