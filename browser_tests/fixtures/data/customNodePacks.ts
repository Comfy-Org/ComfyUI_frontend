import { Buffer } from 'node:buffer'

import type { CustomNodeUploadRecordDto } from '@/platform/customNodes/composables/useCustomNodePacks'

export const customNodeDownloadArchive = Buffer.from(
  'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
  'base64'
)

export const customNodeDownloadRecord: CustomNodeUploadRecordDto = {
  revision_id: 'echo-pack-revision',
  name: 'Echo Pack',
  owner: 'ws-personal',
  snapshot: '/uploads/echo-pack/revision',
  uploaded_at: '2026-08-28T12:00:00Z'
}
