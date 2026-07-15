<template>
  <GettingStartedCard
    :image-src="thumbnailSrc"
    :title
    :loading
    :testid="`getting-started-card-${template.name}`"
    @select="emit('select', template.name)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

import GettingStartedCard from './GettingStartedCard.vue'

const { template, loading = false } = defineProps<{
  template: TemplateInfo
  loading?: boolean
}>()

const emit = defineEmits<{ select: [id: string] }>()

const { getTemplateThumbnailUrl, getTemplateTitle } = useTemplateWorkflows()

const thumbnailSrc = computed(() =>
  getTemplateThumbnailUrl(template, 'default')
)
const title = computed(() => getTemplateTitle(template, 'default'))
</script>
