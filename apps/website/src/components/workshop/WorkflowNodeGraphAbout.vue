<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphNeeds } from '@/composables/useNodeGraphNeeds'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

import WorkflowNodeGraphAboutFooter from './WorkflowNodeGraphAboutFooter.vue'
import WorkflowNodeGraphInputs from './WorkflowNodeGraphInputs.vue'

const {
  workflow,
  needs,
  active,
  locale = 'en'
} = defineProps<{
  workflow: NodeGraphWorkflow
  needs: NodeGraphNeeds
  active: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ download: []; tryCloud: [] }>()
const { t } = translationsFor(locale)

const expanded = ref(false)
const lead = computed(() => workflow.description[0])
const more = computed(() => workflow.description.slice(1))
</script>

<template>
  <section
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    aria-labelledby="workflow-about-heading"
    data-testid="node-graph-about"
  >
    <h2
      id="workflow-about-heading"
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.nodeGraph.about') }}
    </h2>
    <div class="space-y-6 p-5">
      <div class="space-y-3 text-sm/relaxed text-primary-comfy-canvas">
        <p
          v-if="lead"
          class="wrap-break-word whitespace-pre-line"
          v-text="lead"
        />
        <p
          v-for="(paragraph, index) in more"
          v-show="expanded"
          :key="index"
          class="wrap-break-word whitespace-pre-line"
          v-text="paragraph"
        />
        <button
          v-if="more.length"
          type="button"
          class="cursor-pointer text-sm text-primary-warm-gray underline underline-offset-4 hover:text-primary-comfy-yellow"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{
            t(
              expanded
                ? 'workshop.nodeGraph.readLess'
                : 'workshop.nodeGraph.readMore'
            )
          }}
        </button>
      </div>

      <WorkflowNodeGraphInputs :needs="needs" :locale="locale" />
    </div>

    <WorkflowNodeGraphAboutFooter
      v-if="workflow.cloudHref || workflow.downloadUrl"
      :cloud-href="workflow.cloudHref"
      :download-url="workflow.downloadUrl"
      :download-name="workflow.downloadName"
      :works-on-cloud="workflow.worksOnCloud"
      :active="active"
      :locale="locale"
      @download="emit('download')"
      @try-cloud="emit('tryCloud')"
    />
  </section>
</template>
