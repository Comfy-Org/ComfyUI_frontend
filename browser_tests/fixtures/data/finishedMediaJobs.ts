import type { RawJobListItem } from '@comfyorg/api-client/jobTypes'

import { createRouteMockJob } from '@e2e/fixtures/jobsRouteFixture'

export const finishedImage = {
  jobId: 'job-finished-image',
  filename: 'frame_00002_.png'
} as const

export const finishedVideo = {
  jobId: 'job-finished-video',
  filename: 'clip_00001_.mp4'
} as const

export const finishedMediaJobs: readonly RawJobListItem[] = [
  createRouteMockJob({
    id: finishedImage.jobId,
    preview_output: {
      filename: finishedImage.filename,
      subfolder: '',
      type: 'output',
      nodeId: '9',
      mediaType: 'images'
    }
  }),
  createRouteMockJob({
    id: finishedVideo.jobId,
    preview_output: {
      filename: finishedVideo.filename,
      subfolder: '',
      type: 'output',
      nodeId: '9',
      mediaType: 'video'
    }
  })
]
