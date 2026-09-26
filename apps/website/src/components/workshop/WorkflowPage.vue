<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { computed } from 'vue'

import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { t } from '../../i18n/translations'
import WorkflowPlayground from './WorkflowPlayground.vue'

const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()
const emit = defineEmits<{ recovery: [active: boolean] }>()
const { session } = useWorkshopSession()
const scope = computed(() =>
  session.value
    ? JSON.stringify([session.value.uid, session.value.workspace.id])
    : 'anonymous'
)
const template = model.workflow.template
const cloudHref = template
  ? `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(template.id)}`
  : undefined
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8">
    <a
      href="/models/?type=workflows"
      class="mb-7 inline-flex min-h-11 items-center gap-1 text-sm text-primary-warm-gray hover:text-primary-comfy-yellow"
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
      {{ t('workshop.catalogue.backToWorkflows') }}
    </a>
    <header class="mb-9" data-testid="workflow-hero">
      <p v-if="model.category" class="mb-3 text-sm text-primary-comfy-yellow">
        {{ model.categoryLabel?.en ?? model.category }}
      </p>
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ model.name }}
      </h1>
      <p
        v-if="model.summary"
        class="mt-4 max-w-3xl text-lg text-primary-warm-gray"
      >
        {{ model.summary }}
      </p>
      <div
        v-if="template"
        class="mt-5 flex flex-wrap gap-2 text-xs text-primary-warm-gray"
      >
        <span
          v-for="name in template.models"
          :key="name"
          class="rounded-full border border-transparency-white-t20 px-3 py-1.5"
          >{{ name }}</span
        >
        <span class="px-2 py-1.5">
          {{
            t('workshop.workflow.templateBy', 'en', {
              author: template.author
            })
          }}
        </span>
      </div>
    </header>

    <WorkflowPlayground
      :key="scope"
      :model="model"
      :scope="scope"
      :cloud-href="cloudHref"
      @recovery="emit('recovery', $event)"
    />
  </div>
</template>
