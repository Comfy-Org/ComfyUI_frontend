<template>
  <div
    role="button"
    :tabindex="loading ? -1 : 0"
    :data-testid="`getting-started-card-${template.name}`"
    :aria-label="title"
    :aria-busy="loading"
    class="group/card focus-visible:ring-ring relative aspect-square cursor-pointer overflow-hidden rounded-2xl focus-visible:ring-1 focus-visible:outline-none"
    @click="onSelect"
    @keydown.enter.prevent="onSelect"
    @keydown.space.prevent="onSelect"
  >
    <LazyImage
      :src="thumbnailSrc"
      :alt="title"
      image-class="size-full object-cover opacity-60 transition-all duration-300 ease-out group-hover/card:scale-105 group-hover/card:opacity-100"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 bg-linear-to-b from-black/40 via-transparent via-50% to-black/40 transition-opacity duration-300 ease-out group-hover/card:opacity-60"
    />
    <h3
      class="absolute inset-x-0 bottom-0 m-0 truncate p-4 text-sm font-semibold text-base-foreground drop-shadow-md"
      :title
    >
      {{ title }}
    </h3>
    <div
      v-if="loading"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base-background/70 backdrop-blur-md"
    >
      <DotSpinner :size="24" />
      <span class="text-xs font-medium text-base-foreground/80">
        {{ t('onboardingTour.preparing') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DotSpinner from '@/components/common/DotSpinner.vue'
import LazyImage from '@/components/common/LazyImage.vue'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

const { template, loading = false } = defineProps<{
  template: TemplateInfo
  loading?: boolean
}>()

const emit = defineEmits<{ select: [id: string] }>()

const { t } = useI18n()
const { getTemplateThumbnailUrl, getTemplateTitle } = useTemplateWorkflows()

const thumbnailSrc = computed(() =>
  getTemplateThumbnailUrl(template, 'default')
)
const title = computed(() => getTemplateTitle(template, 'default'))

function onSelect() {
  if (loading) return
  emit('select', template.name)
}
</script>
