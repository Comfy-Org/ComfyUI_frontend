import type { JobDetailResponse, JobEntry } from '@comfyorg/ingest-types'

import type { ResultItemType } from '../../../src/schemas/apiSchema'

export type ImportedAssetFixture = {
  name: string
  filePath?: string
  contentType?: string
}

export type GeneratedOutputFixture = {
  filename: string
  displayName?: string
  filePath?: string
  contentType?: string
  mediaType?: 'images' | 'video' | 'audio'
  subfolder?: string
  type?: ResultItemType
}

export type GeneratedJobFixture = {
  jobId: string
  status?: JobEntry['status']
  outputs: [GeneratedOutputFixture, ...GeneratedOutputFixture[]]
  createdAt?: string
  createTime?: number
  executionStartTime?: number
  executionEndTime?: number
  workflowId?: string
  workflow?: JobDetailResponse['workflow']
  nodeId?: string
}
