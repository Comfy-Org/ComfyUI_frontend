<template>
  <div
    v-if="jobs.length"
    role="status"
    aria-live="polite"
    class="flex flex-col gap-2"
    data-testid="workflow-source-progress"
  >
    <div
      v-for="job in jobs"
      :key="job.pack.key"
      class="flex flex-col gap-1 text-xs"
    >
      <span class="font-medium">{{ job.pack.name }}</span>
      <template v-if="job.phase === 'resolving' || job.phase === 'preparing'">
        <span>{{ t('magicPatch.resolvingWorkflowSource') }}</span>
        <span
          v-if="job.phase === 'preparing' && job.disconnected"
          role="alert"
          >{{ message(job.reason, 'magicPatch.disconnected') }}</span
        >
        <progress
          v-else
          :aria-label="t('magicPatch.packProgress', { pack: job.pack.name })"
          class="h-2 w-full accent-primary-background"
        />
      </template>
      <span v-else-if="job.phase === 'error'" role="alert">
        {{ message(job.reason, 'magicPatch.unavailable') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { WorkflowSourceJob } from '../stores/magicPatchBatchStore'

const { jobs } = defineProps<{ jobs: WorkflowSourceJob[] }>()
const { t, te } = useI18n()

function message(reason: string | undefined, fallback: string) {
  const key = `magicPatch.reasons.${reason}`
  return t(reason && te(key) ? key : fallback)
}
</script>
