<template>
  <div
    class="w-[260px] min-w-[260px] rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] shadow-md"
  >
    <div
      class="flex items-center border-b border-[var(--color-charcoal-400)] p-[var(--spacing-spacing-md)]"
    >
      <span
        class="text-[0.875rem] leading-normal font-normal text-text-primary"
        >{{ headerText }}</span
      >
    </div>
    <div
      class="px-[var(--spacing-spacing-md)] pt-[var(--spacing-spacing-md)] pb-[var(--spacing-spacing-md)]"
    >
      <div
        class="grid grid-cols-2 items-center gap-x-[var(--spacing-spacing-md)] gap-y-[var(--spacing-spacing-sm)]"
      >
        <div
          class="flex items-center text-[0.75rem] leading-normal font-normal text-text-primary"
        >
          {{ workflowLabel }}
        </div>
        <div
          class="flex min-w-0 items-center text-[0.75rem] leading-normal font-normal text-[var(--color-text-secondary)]"
        >
          <span class="block min-w-0 truncate">{{ workflowValue }}</span>
        </div>
        <div
          class="flex items-center text-[0.75rem] leading-normal font-normal text-text-primary"
        >
          {{ jobIdLabel }}
        </div>
        <div
          class="flex min-w-0 items-center text-[0.75rem] leading-normal font-normal text-[var(--color-text-secondary)]"
        >
          <span class="min-w-0 truncate">{{ jobIdValue }}</span>
          <button
            type="button"
            class="ml-[var(--spacing-spacing-xs)] inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:opacity-90"
            :aria-label="copyAriaLabel"
            @click.stop="copyJobId"
          >
            <i
              class="icon-[lucide--copy] block size-4 leading-none text-[var(--color-text-secondary)]"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { st, t } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const props = defineProps<{
  jobId: string
  workflowId?: string
}>()

const headerText = computed(() => st('queue.jobDetails.header', 'Job Details'))
const workflowLabel = computed(() =>
  st('queue.jobDetails.workflow', 'Workflow')
)
const jobIdLabel = computed(() => st('queue.jobDetails.jobId', 'Job ID'))
const copyAriaLabel = computed(() => t('g.copy'))

const workflowStore = useWorkflowStore()

const workflowValue = computed(() => {
  const wid = props.workflowId
  if (!wid) return ''
  const activeId = workflowStore.activeWorkflow?.activeState?.id
  if (activeId && activeId === wid) {
    return workflowStore.activeWorkflow?.filename ?? wid
  }
  return wid
})
const jobIdValue = computed(() => props.jobId)

const { copyToClipboard } = useCopyToClipboard()
const copyJobId = () => copyToClipboard(jobIdValue.value)
</script>
