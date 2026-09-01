import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import type {
  JobDetail,
  RawJobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'

export const SAMPLE_JOBS: RawJobListItem[] = [
  createMockJob({
    id: 'job-alpha',
    create_time: 1000,
    execution_start_time: 1000,
    execution_end_time: 1010,
    preview_output: {
      filename: 'landscape.png',
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-beta',
    create_time: 2000,
    execution_start_time: 2000,
    execution_end_time: 2003,
    preview_output: {
      filename: 'portrait.png',
      subfolder: '',
      type: 'output',
      nodeId: '2',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-gamma',
    create_time: 3000,
    execution_start_time: 3000,
    execution_end_time: 3020,
    preview_output: {
      filename: 'abstract_art.png',
      subfolder: '',
      type: 'output',
      nodeId: '3',
      mediaType: 'images'
    },
    outputs_count: 2
  })
]

export const SAMPLE_IMPORTED_FILES = [
  'reference_photo.png',
  'background.jpg',
  'audio_clip.wav'
]

export const JOB_GAMMA_DETAIL: JobDetail = {
  ...SAMPLE_JOBS[2],
  outputs: {
    '3': {
      images: [
        {
          filename: 'abstract_art.png',
          subfolder: '',
          type: 'output'
        },
        {
          filename: 'abstract_art_alt.png',
          subfolder: '',
          type: 'output'
        }
      ]
    }
  },
  workflow: {
    extra_data: {
      extra_pnginfo: {
        workflow: {
          version: 0.4,
          last_node_id: 0,
          last_link_id: 0,
          nodes: [],
          links: []
        }
      }
    }
  }
}
