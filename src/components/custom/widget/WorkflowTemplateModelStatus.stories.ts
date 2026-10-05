import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WorkflowTemplateModelStatus from '@/components/custom/widget/WorkflowTemplateModelStatus.vue'
import type { TemplateDetailRow } from '@/platform/workflow/templates/types/templateDetail'

const meta: Meta<typeof WorkflowTemplateModelStatus> = {
  title: 'Components/Templates/WorkflowTemplateModelStatus',
  component: WorkflowTemplateModelStatus,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

function row(
  name: string,
  status: TemplateDetailRow['status']
): TemplateDetailRow {
  return { id: name, name, description: '', status }
}

const rows: TemplateDetailRow[] = [
  row('idle', {
    kind: 'downloadable',
    label: 'Download model',
    downloadState: { status: 'idle', attempt: 0 }
  }),
  row('queued', {
    kind: 'downloadable',
    label: 'Download model',
    downloadState: { status: 'queued', attempt: 1 }
  }),
  row('starting', {
    kind: 'downloadable',
    label: 'Download model',
    downloadState: { status: 'starting', attempt: 1 }
  }),
  row('active', {
    kind: 'downloadable',
    label: 'Download model',
    downloadState: {
      status: 'downloading',
      attempt: 1,
      activity: 'active',
      receivedBytes: 256_000_000,
      totalBytes: 1_024_000_000,
      fraction: 0.25
    }
  }),
  row('paused', {
    kind: 'downloadable',
    label: 'Download model',
    downloadState: {
      status: 'downloading',
      attempt: 1,
      activity: 'paused',
      receivedBytes: 256_000_000,
      totalBytes: 1_024_000_000,
      fraction: 0.25
    }
  }),
  row('downloaded', {
    kind: 'downloadable',
    label: 'Download model',
    downloadState: { status: 'done', attempt: 1 }
  }),
  row('failed', {
    kind: 'downloadable',
    label: 'Download model',
    downloadState: { status: 'failed', attempt: 1, reason: 'error' }
  }),
  row('cancelled', {
    kind: 'downloadable',
    label: 'Download model',
    downloadState: { status: 'failed', attempt: 1, reason: 'cancelled' }
  }),
  row('installed', { kind: 'installed', label: 'Installed' }),
  row('manual', {
    kind: 'manual',
    label: 'Get it manually',
    href: 'https://example.com/model'
  }),
  row('unavailable', { kind: 'unavailable', label: 'Unavailable' }),
  row('unknown', { kind: 'unknown', label: 'Unknown' })
]

export const EveryState: Story = {
  render: () => ({
    components: { WorkflowTemplateModelStatus },
    setup: () => ({ rows }),
    template: `
      <div class="flex w-96 flex-col gap-2">
        <div
          v-for="row in rows"
          :key="row.id"
          class="flex items-center justify-between gap-4 rounded-md border border-border-default px-3 py-2"
        >
          <span class="text-xs text-muted-foreground">{{ row.name }}</span>
          <WorkflowTemplateModelStatus :row="row" />
        </div>
      </div>
    `
  })
}
