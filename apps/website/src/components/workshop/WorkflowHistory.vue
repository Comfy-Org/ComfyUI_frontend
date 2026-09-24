<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { useWorkflowRun } from '../../composables/useWorkflowRun'
import type { WorkflowRunSummary } from '../../config/workshop-workflow-response'
import { workflowStatusKey } from '../../config/workshop-workflow-presentation'
import { t } from '../../i18n/translations'

const { history, busy, selectedRunId } = defineProps<{
  history: ReturnType<typeof useWorkflowRun>['history']['value']
  busy: boolean
  selectedRunId?: string
}>()
const emit = defineEmits<{
  open: [run: WorkflowRunSummary]
  refresh: []
  more: []
}>()
</script>

<template>
  <details class="rounded-2xl border border-transparency-white-t20 p-5">
    <summary
      class="cursor-pointer text-sm font-medium text-primary-comfy-canvas"
    >
      {{ t('workshop.workflow.history') }}
    </summary>
    <div class="mt-4 space-y-3">
      <p
        v-if="history.status === 'failed'"
        role="status"
        class="text-sm text-primary-warm-gray"
      >
        {{ t('workshop.workflow.historyFailed') }}
      </p>
      <p
        v-else-if="!history.page.items.length"
        role="status"
        class="text-sm text-primary-warm-gray"
      >
        {{
          t(
            history.status === 'loading'
              ? 'workshop.load.pending'
              : 'workshop.workflow.historyEmpty'
          )
        }}
      </p>
      <ul class="space-y-2">
        <li v-for="run in history.page.items" :key="run.id">
          <button
            type="button"
            :disabled="busy"
            :aria-current="run.id === selectedRunId ? 'true' : undefined"
            class="flex min-h-11 w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary-warm-gray hover:bg-transparency-white-t8 disabled:cursor-default disabled:opacity-60 aria-current:bg-transparency-white-t8"
            @click="emit('open', run)"
          >
            <time :datetime="run.createdAt">{{
              new Date(run.createdAt).toLocaleString()
            }}</time
            ><span>{{ t(workflowStatusKey(run)) }}</span>
          </button>
        </li>
      </ul>
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          class="min-h-11"
          :disabled="history.status === 'loading'"
          @click="emit('refresh')"
          >{{ t('workshop.workflow.refreshHistory') }}</Button
        >
        <Button
          v-if="history.page.nextCursor"
          variant="outline"
          class="min-h-11"
          :disabled="history.status === 'loading'"
          @click="emit('more')"
          >{{ t('workshop.workflow.moreHistory') }}</Button
        >
      </div>
    </div>
  </details>
</template>
