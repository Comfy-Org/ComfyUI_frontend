import type { JobEntry } from '@comfyorg/ingest-types'

export function createMockJob(
  overrides: Partial<JobEntry> & { id: string }
): JobEntry {
  const now = Date.now()

  return {
    status: 'completed',
    create_time: now,
    execution_start_time: now,
    execution_end_time: now + 5_000,
    preview_output: {
      filename: `output_${overrides.id}.png`,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1,
    ...overrides
  }
}

export function createMockJobs(
  count: number,
  baseOverrides?: Partial<JobEntry>
): JobEntry[] {
  const now = Date.now()

  return Array.from({ length: count }, (_, index) =>
    createMockJob({
      id: `job-${String(index + 1).padStart(3, '0')}`,
      create_time: now - index * 60_000,
      execution_start_time: now - index * 60_000,
      execution_end_time: now - index * 60_000 + (5 + index) * 1_000,
      preview_output: {
        filename: `image_${String(index + 1).padStart(3, '0')}.png`,
        subfolder: '',
        type: 'output',
        nodeId: '1',
        mediaType: 'images'
      },
      ...baseOverrides
    })
  )
}
