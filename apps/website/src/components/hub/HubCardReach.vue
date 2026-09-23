<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import type { WorkflowReach } from '../../lib/hub/workflow-reach'

// What a workflow needs before anyone can call it. The shared Cloud endpoint
// is the ordinary case and says nothing; a card only speaks up for the few
// that ask for an install, because a mark on every card marks nothing.
const { reach, locale = 'en' } = defineProps<{
  reach: WorkflowReach | undefined
  locale?: Locale
}>()
</script>

<template>
  <span
    v-if="reach === 'endpoint'"
    class="pointer-events-none absolute top-4 right-4 z-20 inline-flex h-7 items-center rounded-lg bg-black/45 px-2 text-2xs/4 font-semibold tracking-wide text-primary-comfy-orange backdrop-blur-md"
    data-testid="hub-card-reach"
  >
    {{ tHub('workshop.v2.card.customNodes', locale) }}
  </span>
</template>
