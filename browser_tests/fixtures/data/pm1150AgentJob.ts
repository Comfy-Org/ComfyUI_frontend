import { createRouteMockJob } from '@e2e/fixtures/jobsRouteFixture'
import type {
  JobDetail,
  RawJobListItem
} from '@/platform/remote/comfyui/jobs/jobTypes'

/**
 * PM-1150 (job 33a723f2-bf1f-4faf-9c42-1b83e2185601): a synthetic fixture
 * representing the job shape comfy-cli's `run` command produces —
 * `workflow.prompt` present, `extra_data.extra_pnginfo.workflow` absent. No
 * captured job-detail response for the real job is available (see PM-1150),
 * so this is representative coverage of the fallback path, not a
 * byte-for-byte reproduction of a specific production payload.
 */
export const PM_1150_JOB_ID = '33a723f2-bf1f-4faf-9c42-1b83e2185601'

export const PM_1150_API_PROMPT = {
  '1': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'v1-5-pruned-emaonly.ckpt' },
    _meta: { title: 'Load Checkpoint' }
  },
  '2': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'a duck wearing a wizard hat', clip: ['1', 1] },
    _meta: { title: 'CLIP Text Encode (Prompt)' }
  },
  '3': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'blurry, low quality', clip: ['1', 1] },
    _meta: { title: 'CLIP Text Encode (Negative)' }
  },
  '4': {
    class_type: 'EmptyLatentImage',
    inputs: { width: 512, height: 512, batch_size: 1 },
    _meta: { title: 'Empty Latent Image' }
  },
  '5': {
    class_type: 'KSampler',
    inputs: {
      seed: 156680208700286,
      steps: 20,
      cfg: 8,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1,
      model: ['1', 0],
      positive: ['2', 0],
      negative: ['3', 0],
      latent_image: ['4', 0]
    },
    _meta: { title: 'KSampler' }
  },
  '6': {
    class_type: 'VAEDecode',
    inputs: { samples: ['5', 0], vae: ['1', 2] },
    _meta: { title: 'VAE Decode' }
  },
  '7': {
    class_type: 'SaveImage',
    inputs: { filename_prefix: 'ComfyUI', images: ['6', 0] },
    _meta: { title: 'Save Image' }
  }
} as const

export const pm1150Job: RawJobListItem = createRouteMockJob({
  id: PM_1150_JOB_ID,
  preview_output: {
    filename: 'agent_job_output.png',
    subfolder: '',
    type: 'output',
    nodeId: '7',
    mediaType: 'images'
  },
  outputs_count: 1,
  workflow_id: 'agent-service-workflow'
})

export const pm1150JobDetail: JobDetail = {
  ...pm1150Job,
  outputs: {
    '7': {
      images: [
        { filename: 'agent_job_output.png', subfolder: '', type: 'output' }
      ]
    }
  },
  // No `extra_data` at all — the fallback path this fixture exercises.
  workflow: {
    prompt: PM_1150_API_PROMPT
  }
}
