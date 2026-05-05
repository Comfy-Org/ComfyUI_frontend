import type { JobDetailResponse, JobEntry } from '@comfyorg/ingest-types'

import type { MockJobRecord } from '@e2e/fixtures/helpers/JobsApiMock'

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
