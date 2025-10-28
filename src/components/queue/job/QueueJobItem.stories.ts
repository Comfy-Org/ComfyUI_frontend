import type { Meta, StoryObj } from '@storybook/vue3-vite'

import QueueJobItem from './QueueJobItem.vue'

const meta: Meta<typeof QueueJobItem> = {
  title: 'Queue/QueueJobItem',
  component: QueueJobItem,
  parameters: {
    layout: 'padded'
  },
  argTypes: {
    onClear: { action: 'clear' },
    onMenu: { action: 'menu' },
    onView: { action: 'view' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

const thumb = (hex: string) =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect width='256' height='256' fill='%23${hex}'/></svg>`

export const Added: Story = {
  args: {
    jobId: 'job-added-1',
    state: 'added',
    title: 'New job added',
    rightText: '12:30 PM'
  }
}

export const Queued: Story = {
  args: {
    jobId: 'job-queued-1',
    state: 'queued',
    title: 'Queued job',
    rightText: '12:31 PM'
  }
}

export const Initialization: Story = {
  args: {
    jobId: 'job-init-1',
    state: 'initialization',
    title: 'Initializing...'
  }
}

export const RunningTotalOnly: Story = {
  args: {
    jobId: 'job-running-1',
    state: 'running',
    title: 'Generating image',
    progressTotalPercent: 42
  }
}

export const RunningWithCurrent: Story = {
  args: {
    jobId: 'job-running-2',
    state: 'running',
    title: 'Generating image',
    progressTotalPercent: 66,
    progressCurrentPercent: 10,
    runningNodeName: 'KSampler'
  }
}

export const CompletedWithPreview: Story = {
  args: {
    jobId: 'job-completed-1',
    state: 'completed',
    title: 'Prompt #1234',
    rightText: '12.79s',
    iconImageUrl: thumb('4dabf7')
  }
}

export const CompletedNoPreview: Story = {
  args: {
    jobId: 'job-completed-2',
    state: 'completed',
    title: 'Prompt #5678',
    rightText: '8.12s'
  }
}

export const Failed: Story = {
  args: {
    jobId: 'job-failed-1',
    state: 'failed',
    title: 'Failed job',
    rightText: 'Failed'
  }
}

export const Gallery: Story = {
  render: (args) => ({
    components: { QueueJobItem },
    setup() {
      return { args }
    },
    template: `
      <div class="flex flex-col gap-2 w-[420px]">
        <QueueJobItem job-id="job-added-1" state="added" title="New job added" right-text="12:30 PM" v-bind="args" />
        <QueueJobItem job-id="job-queued-1" state="queued" title="Queued job" right-text="12:31 PM" v-bind="args" />
        <QueueJobItem job-id="job-init-1" state="initialization" title="Initializing..." v-bind="args" />
        <QueueJobItem job-id="job-running-1" state="running" title="Generating image" :progress-total-percent="42" v-bind="args" />
        <QueueJobItem
          job-id="job-running-2"
          state="running"
          title="Generating image"
          :progress-total-percent="66"
          :progress-current-percent="10"
          running-node-name="KSampler"
          v-bind="args"
        />
        <QueueJobItem
          job-id="job-completed-1"
          state="completed"
          title="Prompt #1234"
          right-text="12.79s"
          icon-image-url="${thumb('4dabf7')}"
          v-bind="args"
        />
        <QueueJobItem job-id="job-completed-2" state="completed" title="Prompt #5678" right-text="8.12s" v-bind="args" />
        <QueueJobItem job-id="job-failed-1" state="failed" title="Failed job" right-text="Failed" v-bind="args" />
      </div>
    `
  })
}
