import type { RawJobListItem } from '@comfyorg/api-client/jobTypes'

import { createRouteMockJob } from '@e2e/fixtures/jobsRouteFixture'

export const draggedImageOutput = {
  jobId: 'job-drag-image',
  filename: 'frame_00002_.png'
} as const

export const draggedVideoOutput = {
  jobId: 'job-drag-video',
  filename: 'clip_00001_.mp4'
} as const

export const jobOutputDragJobs: readonly RawJobListItem[] = [
  createRouteMockJob({
    id: draggedImageOutput.jobId,
    preview_output: {
      filename: draggedImageOutput.filename,
      subfolder: '',
      type: 'output',
      nodeId: '9',
      mediaType: 'images'
    }
  }),
  createRouteMockJob({
    id: draggedVideoOutput.jobId,
    preview_output: {
      filename: draggedVideoOutput.filename,
      subfolder: '',
      type: 'output',
      nodeId: '9',
      mediaType: 'video'
    }
  })
]
