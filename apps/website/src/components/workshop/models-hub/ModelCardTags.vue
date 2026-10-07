<script setup lang="ts">
import { computed } from 'vue'

import TagRow from '@/components/hub/TagRow.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import ModelAccessBadges from '@/components/workshop/explorer/ModelAccessBadges.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { accessFor } from '@/lib/workshop/explorer/model-access'
import { taskLabelFor } from '@/lib/workshop/task-label'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopModel
  locale?: Locale
}>()

const taskLabel = computed(() => taskLabelFor(model, locale))
const access = computed(() => accessFor(model))
</script>

<template>
  <div class="mt-auto flex h-6 min-w-0 items-center gap-1.5 overflow-hidden">
    <Badge variant="subtle">{{ taskLabel }}</Badge>
    <ModelAccessBadges v-if="access.length" :access :locale />
    <TagRow
      :tags="model.capabilities"
      :link-tags="false"
      class="min-w-0 flex-1"
    />
  </div>
</template>
