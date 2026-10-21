<script setup lang="ts">
import { Puzzle } from '@lucide/vue'
import { computed } from 'vue'

import type { NodeGraphNeeds } from '@/composables/useNodeGraphNeeds'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { needs, locale = 'en' } = defineProps<{
  needs: NodeGraphNeeds
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const customNodes = computed(() =>
  needs.status === 'read' ? needs.customNodes : []
)

const headingClass =
  'text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <section
    v-if="needs.status !== 'read' || customNodes.length"
    class="overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 px-5 py-4"
    data-testid="workflow-custom-nodes"
  >
    <h3 :class="headingClass">{{ t('workshop.workflow.customNodes') }}</h3>
    <ul
      class="mt-2 flex flex-col gap-1"
      :aria-busy="needs.status === 'loading'"
    >
      <li
        v-if="needs.status === 'loading'"
        class="flex items-center gap-2.5 py-1.5"
        data-testid="workflow-custom-nodes-loading"
      >
        <span
          class="h-4 w-40 rounded-sm bg-transparency-white-t8 motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <span class="sr-only">{{ t('workshop.nodeGraph.reading') }}</span>
      </li>
      <li
        v-if="needs.status === 'failed'"
        class="py-1.5 text-sm text-primary-warm-gray"
        data-testid="workflow-custom-nodes-failed"
      >
        {{ t('workshop.nodeGraph.readFailed') }}
      </li>
      <li
        v-for="(name, index) in customNodes"
        :key="index"
        class="flex items-center gap-2.5 py-1.5"
      >
        <Puzzle
          class="size-4 shrink-0 text-primary-warm-gray"
          aria-hidden="true"
        />
        <span
          class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas"
        >
          {{ name }}
        </span>
      </li>
    </ul>
  </section>
</template>
