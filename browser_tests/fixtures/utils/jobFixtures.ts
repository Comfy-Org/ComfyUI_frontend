import type { JobDetailResponse, JobEntry } from '@comfyorg/ingest-types'

import type { MockJobRecord } from '@e2e/fixtures/helpers/JobsApiMock'

export type MediaKindFixture = 'images' | 'video' | 'audio' | '3D'

const DEFAULT_EXTENSION: Record<MediaKindFixture, string> = {
  images: 'png',
  video: 'mp4',
  audio: 'wav',
  '3D': 'glb'
}

export function createMockJob(
  overrides: Partial<JobEntry> & {
    id: string
    mediaKind?: MediaKindFixture
  }
): JobEntry {
  const { mediaKind, ...rest } = overrides
  const now = Date.now()
  const extension = mediaKind ? DEFAULT_EXTENSION[mediaKind] : 'png'
  const mediaType = mediaKind ?? 'images'

  return {
    status: 'completed',
    create_time: now,
    execution_start_time: now,
    execution_end_time: now + 5_000,
    preview_output: {
      filename: `output_${rest.id}.${extension}`,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType
    },
    outputs_count: 1,
    ...rest
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

export function createMixedMediaJobs(kinds: MediaKindFixture[]): JobEntry[] {
  const now = Date.now()

  return kinds.map((kind, index) =>
    createMockJob({
      id: `${kind}-${String(index + 1).padStart(3, '0')}`,
      mediaKind: kind,
      create_time: now - index * 60_000,
      execution_start_time: now - index * 60_000,
      execution_end_time: now - index * 60_000 + 5_000
    })
  )
}

export function createJobsWithExecutionTimes(
  specs: ReadonlyArray<{ createTime: number; durationMs: number }>
): JobEntry[] {
  return specs.map((spec, index) =>
    createMockJob({
      id: `job-${String(index + 1).padStart(3, '0')}`,
      create_time: spec.createTime,
      execution_start_time: spec.createTime,
      execution_end_time: spec.createTime + spec.durationMs
    })
  )
}

function isTerminalStatus(status: JobEntry['status']) {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

function createMockJobRecord(listItem: JobEntry): MockJobRecord {
  const updateTime =
    listItem.execution_end_time ??
    listItem.execution_start_time ??
    listItem.create_time
  const detail: JobDetailResponse = {
    ...listItem,
    update_time: updateTime,
    ...(isTerminalStatus(listItem.status) ? { outputs: {} } : {})
  }

  return {
    listItem,
    detail
  }
}

export function createMockJobRecords(
  listItems: readonly JobEntry[]
): MockJobRecord[] {
  return listItems.map(createMockJobRecord)
}
