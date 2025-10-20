<template>
  <div
    class="w-[260px] min-w-[260px] rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] text-white shadow-md"
  >
    <div
      class="flex h-10 items-center border-b border-[var(--color-charcoal-400)] px-[var(--spacing-spacing-xs)]"
    >
      <span class="text-[14px] font-normal">{{ headerText }}</span>
    </div>
    <div class="px-[var(--spacing-spacing-sm)] py-[var(--spacing-spacing-sm)]">
      <div
        class="grid grid-cols-2 gap-x-[var(--spacing-spacing-md)] gap-y-[var(--spacing-spacing-sm)]"
      >
        <div class="text-[12px] leading-none text-white">
          {{ workflowLabel }}
        </div>
        <div
          class="min-w-0 text-[12px] leading-none text-[var(--color-slate-100)]"
        >
          <span class="block truncate">{{ workflowValue }}</span>
        </div>
        <div class="text-[12px] leading-none text-white">
          {{ jobIdLabel }}
        </div>
        <div
          class="inline-flex min-w-0 items-center text-[12px] leading-none text-[var(--color-slate-100)]"
        >
          <span class="min-w-0 truncate">{{ jobIdValue }}</span>
          <button
            type="button"
            class="ml-[var(--spacing-spacing-xs)] inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:opacity-90"
            :aria-label="copyAriaLabel"
            @click.stop="copyJobId"
          >
            <i
              class="icon-[lucide--copy] block size-4 leading-none text-[var(--color-slate-100)]"
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

const headerText = computed(() => st('queue.jobDetails.header', 'Job Details'))
const workflowLabel = computed(() =>
  st('queue.jobDetails.workflow', 'Workflow')
)
const jobIdLabel = computed(() => st('queue.jobDetails.jobId', 'Job ID'))
const copyAriaLabel = computed(() => t('g.copy'))

const workflowValue = 'Workflow name (workflow filename)'
const jobIdValue = 'Job ID'

const { copyToClipboard } = useCopyToClipboard()
const copyJobId = () => copyToClipboard(jobIdValue)
</script>
