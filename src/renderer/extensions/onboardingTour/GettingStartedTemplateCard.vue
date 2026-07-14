<template>
  <CardContainer
    variant="ghost"
    rounded="lg"
    role="button"
    :tabindex="loading ? -1 : 0"
    :data-testid="`getting-started-card-${template.name}`"
    :aria-label="title"
    :aria-busy="loading"
    class="group/card focus-visible:ring-ring hover:bg-node-component-surface focus-visible:ring-1 focus-visible:outline-none"
    @click="onSelect"
    @keydown.enter.prevent="onSelect"
    @keydown.space.prevent="onSelect"
  >
    <template #top>
      <CardTop ratio="square">
        <div class="relative size-full overflow-hidden rounded-lg">
          <LazyImage
            :src="thumbnailSrc"
            :alt="title"
            image-class="size-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-105"
          />
          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/40 to-transparent"
          />
          <div
            v-if="loading"
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base-background/80 backdrop-blur-sm"
          >
            <DotSpinner :size="28" />
            <span class="text-xs text-muted-foreground">
              {{ t('onboardingTour.preparing') }}
            </span>
          </div>
        </div>
      </CardTop>
    </template>
    <template #bottom>
      <CardBottom>
        <h3
          class="m-0 truncate pt-2 text-sm font-semibold text-base-foreground"
          :title
        >
          {{ title }}
        </h3>
      </CardBottom>
    </template>
  </CardContainer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
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
