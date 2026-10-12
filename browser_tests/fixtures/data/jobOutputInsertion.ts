import type { Asset } from '@comfyorg/ingest-types'

import { createRouteMockJob } from '@e2e/fixtures/jobsRouteFixture'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

interface JobOutputInsertionCase {
  asset: Asset
  job: RawJobListItem
  mediaKind: 'image' | 'video'
  nodeType: 'LoadImage' | 'LoadVideo'
}

const createdAt = '2026-07-24T00:00:00Z'
const imageOutputFilename = 'job-queue-image-output.png'
const videoOutputFilename = 'job-queue-video-output.mp4'

export const jobOutputInsertionCases: readonly JobOutputInsertionCase[] = [
  {
    asset: {
      id: 'job-queue-image-asset',
      name: 'ComfyUI_job_queue_image.png',
      hash: imageOutputFilename,
      mime_type: 'image/png',
      tags: ['output'],
      created_at: createdAt,
      updated_at: createdAt
    },
    job: createRouteMockJob({
      id: 'job-queue-image',
      preview_output: {
        filename: imageOutputFilename,
        subfolder: '',
        type: 'output',
        nodeId: '1',
        mediaType: 'images'
      }
    }),
    mediaKind: 'image',
    nodeType: 'LoadImage'
  },
  {
    asset: {
      id: 'job-queue-video-asset',
      name: 'ComfyUI_job_queue_video.mp4',
      hash: videoOutputFilename,
      mime_type: 'video/mp4',
      tags: ['output'],
      created_at: createdAt,
      updated_at: createdAt
    },
    job: createRouteMockJob({
      id: 'job-queue-video',
      preview_output: {
        filename: videoOutputFilename,
        subfolder: '',
        type: 'output',
        nodeId: '2',
        mediaType: 'video'
      }
    }),
    mediaKind: 'video',
    nodeType: 'LoadVideo'
  }
]

export const jobOutputInsertionAssets = jobOutputInsertionCases.map(
  ({ asset }) => asset
)

export const jobOutputInsertionJobs = jobOutputInsertionCases.map(
  ({ job }) => job
)
