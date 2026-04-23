import type {
  JobDetail,
  RawJobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'

export interface CreateJobDetailFixtureOptions {
  id?: string
  workflow?: unknown
  overrides?: Omit<Partial<JobDetail>, 'id'>
  jobOverrides?: Omit<Partial<RawJobListItem>, 'id'>
}

const DEFAULT_JOB_ID = 'job-detail-001'

/**
 * Builds a `JobDetail` with `workflow` nested at
 * `workflow.extra_data.extra_pnginfo.workflow` — the shape parsed by
 * `extractWorkflow()` via `zWorkflowContainer`. Omit `workflow` to
 * simulate the "no workflow data" branch.
 */
export function createJobDetailFixture({
  id = DEFAULT_JOB_ID,
  workflow,
  overrides,
  jobOverrides
}: CreateJobDetailFixtureOptions = {}): JobDetail {
  const now = Date.now()
  const base: JobDetail = {
    id,
    status: 'completed',
    create_time: now,
    execution_start_time: now,
    execution_end_time: now + 5_000,
    preview_output: {
      filename: `output_${id}.png`,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1,
    priority: 0,
    ...jobOverrides
  }

  const detail: JobDetail = {
    ...base,
    ...(workflow !== undefined && {
      workflow: { extra_data: { extra_pnginfo: { workflow } } }
    }),
    ...overrides
  }

  return detail
}
