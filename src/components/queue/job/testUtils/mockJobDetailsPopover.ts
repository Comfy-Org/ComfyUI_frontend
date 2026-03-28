import { vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  jobDetailsPopoverStub: {
    name: 'JobDetailsPopover',
    props: {
      jobId: { type: String, required: true },
      workflowId: { type: String, default: undefined }
    },
    template:
      '<div class="job-details-popover-stub" :data-job-id="jobId" :data-workflow-id="workflowId" />'
  }
}))

export const JobDetailsPopoverStub = hoisted.jobDetailsPopoverStub

vi.mock('@/components/queue/job/JobDetailsPopover.vue', () => ({
  default: JobDetailsPopoverStub
}))
