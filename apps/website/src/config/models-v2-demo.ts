// DEMO DATA for the /models-v2 A/B-test preview (not linked, noindex).
// Featured roster = the actual 2026 launch lineup, ordered by measured landing
// CVR where known (PostHog, Aug 2026) and partner spend rank (Jan–May 2026
// Ramp data — used for ordering only; dollar figures deliberately not shown).
// Run counts and per-run prices are placeholder estimates labeled "est."
// Delete this file with the preview pages.
import { models } from './models'

const TPL =
  'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates'

// Image CDN proxy: raw.githubusercontent rate-limits pages that request many
// images at once. weserv caches + resizes at the edge — and doubles as the
// demo of the rendition discipline from the gap audit (819KB raw → ~40KB card).
export const proxyImg = (u: string, w = 800) =>
  `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=${w}&q=80&output=webp`

export type Modality =
  | 'video'
  | 'i2v'
  | 'image'
  | 'edit'
  | 'audio'
  | 'upscale'
  | '3d'

export interface LaunchModel {
  slug: string
  name: string
  publisher: string
  blurb: string
  modality: Modality
  kind: 'open weights' | 'partner api'
  dayZero?: boolean
  img: string
  gallery: string[]
  runs: string
  price: string
  launchUrl?: string
  workflowsUrl: string
  promptExample: string
}

export const modalityMeta: Record<Modality, { label: string; color: string }> =
  {
    video: { label: 'Text to video', color: '#96b4ff' },
    i2v: { label: 'Image to video', color: '#96b4ff' },
    image: { label: 'Text to image', color: '#ff99f7' },
    edit: { label: 'Image edit', color: '#dbd6f2' },
    audio: { label: 'Audio + music', color: '#b7ded5' },
    upscale: { label: 'Upscale', color: '#b7ded5' },
    '3d': { label: '3D', color: '#fabc25' }
  }

const t = (n: string) => proxyImg(`${TPL}/${n}`, 800)

// Ordered: measured CVR leaders first (flux-3 15.6%, minimax-h3 9.9%,
// wan launches 8–9%), then day-zero freshness.
export const launches: LaunchModel[] = [
  {
    slug: 'flux-3',
    name: 'FLUX 3',
    publisher: 'Black Forest Labs',
    blurb:
      'Frontier video generation. Animate a still frame into coherent, natural motion.',
    modality: 'i2v',
    kind: 'partner api',
    dayZero: true,
    img: t('api_bfl_flux3_i2v-1.webp'),
    gallery: [
      t('api_bfl_flux3_i2v-1.webp'),
      t('api_bfl_flux3_t2v-1.webp'),
      t('api_bfl_flux2_max_sofa_swap-1.webp'),
      t('api_bfl_flux1_expand_image-1.webp')
    ],
    runs: '2.4M runs · est.',
    price: 'from $0.09 / run · est.',
    launchUrl: 'https://comfy.org/flux-3',
    workflowsUrl: 'https://comfy.org/workflows/model/flux',
    promptExample:
      'A paper crane unfolds itself and lifts off a desk, morning light through blinds — subtle camera push.'
  },
  {
    slug: 'minimax-h3',
    name: 'MiniMax H3',
    publisher: 'MiniMax',
    blurb:
      'Image-to-video with strong physics and character hold across shots.',
    modality: 'i2v',
    kind: 'partner api',
    dayZero: true,
    img: t('api_minimax_h3_t2v-1.webp'),
    gallery: [
      t('api_minimax_h3_t2v-1.webp'),
      t('api_minimax_h3_r2v-1.webp'),
      t('api_minimax_h3_flf2v-1.webp')
    ],
    runs: '980k runs · est.',
    price: 'from $0.10 / run · est.',
    launchUrl: 'https://comfy.org/minimax-h3',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'A dancer mid-spin frozen in a warehouse — continue the motion, cloth and hair follow through.'
  },
  {
    slug: 'wan-2-2',
    name: 'Wan 2.2',
    publisher: 'Alibaba',
    blurb:
      'Open-weights video generation. The production baseline for i2v on the graph.',
    modality: 'video',
    kind: 'open weights',
    img: t('video_wan_vace_14B_ref2v-1.webp'),
    gallery: [
      t('video_wan_vace_14B_ref2v-1.webp'),
      t('api_wan2_6_i2v-1.webp'),
      t('api_wan2_6_t2v-1.webp')
    ],
    runs: '1.8M runs · est.',
    price: 'from $0.04 / run · est.',
    workflowsUrl: 'https://comfy.org/workflows/model/wan',
    promptExample:
      'Golden hour drone shot pushing over a ridge line, fog pooling in the valley — native ambient audio.'
  },
  {
    slug: 'wan-3-0',
    name: 'Wan 3.0',
    publisher: 'Alibaba',
    blurb:
      'The next Wan generation — higher fidelity, longer shots, still open weights.',
    modality: 'video',
    kind: 'open weights',
    dayZero: true,
    img: t('api_wan2_7_t2v-1.webp'),
    gallery: [
      t('api_wan2_7_t2v-1.webp'),
      t('api_wan2_7_i2v-1.webp'),
      t('api_wan2_7_r2v-1.webp')
    ],
    runs: '640k runs · est.',
    price: 'from $0.05 / run · est.',
    launchUrl: 'https://comfy.org/wan-3-0',
    workflowsUrl: 'https://comfy.org/workflows/model/wan',
    promptExample:
      'Slow orbital shot of a lighthouse in a storm, waves breaking white against the rocks.'
  },
  {
    slug: 'ltx-2-5',
    name: 'LTX 2.5',
    publisher: 'Lightricks',
    blurb:
      'Fast iteration video. Draft loops in seconds, refine on the same seed.',
    modality: 'video',
    kind: 'open weights',
    dayZero: true,
    img: t('api_ltx2_5_t2v-1.webp'),
    gallery: [
      t('api_ltx2_5_t2v-1.webp'),
      t('api_ltx2_5_i2v-1.webp'),
      t('api_ltx2_5_flf2v-1.webp')
    ],
    runs: '510k runs · est.',
    price: 'from $0.02 / run · est.',
    launchUrl: 'https://comfy.org/ltx-2-5',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'Looping macro of ink diffusing through water, teal into black, an unbroken loop.'
  },
  {
    slug: 'seedance-2-5',
    name: 'Seedance 2.5',
    publisher: 'ByteDance',
    blurb:
      'Native 30-second single-shot video at 720p, from text or reference frames.',
    modality: 'video',
    kind: 'partner api',
    img: t('api_seedance2_0_flf2v-1.webp'),
    gallery: [
      t('api_seedance2_0_flf2v-1.webp'),
      t('api_seedance2_0_mini_r2v-1.webp'),
      t('api_bytedance_seedance1_5_text_to_video-1.webp')
    ],
    runs: '880k runs · est.',
    price: 'from $0.12 / run · est.',
    launchUrl: 'https://comfy.org/seedance-2-5',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'One continuous 30-second take: a chef plates a dish as the camera circles the pass.'
  },
  {
    slug: 'grok-imagine-2',
    name: 'Grok Imagine 2',
    publisher: 'xAI',
    blurb:
      'Image generation and editing with xAI’s latest — on the same canvas as your open models.',
    modality: 'edit',
    kind: 'partner api',
    dayZero: true,
    img: t('api_grok_imagine_image_2_t2i-1.webp'),
    gallery: [
      t('api_grok_imagine_image_2_t2i-1.webp'),
      t('api_grok_imagine_image_2_image_edit-1.webp'),
      t('api_grok_image_edit-1.webp')
    ],
    runs: '420k runs · est.',
    price: 'from $0.07 / run · est.',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'Rebuild this product shot as a 1970s magazine ad — grain, type, and all.'
  },
  {
    slug: 'gpt-image-2',
    name: 'GPT Image 2',
    publisher: 'OpenAI',
    blurb:
      'Fine-grained image generation and editing that follows instructions precisely.',
    modality: 'edit',
    kind: 'partner api',
    img: t('api_openai_gpt_image_2_t2i-1.webp'),
    gallery: [
      t('api_openai_gpt_image_2_t2i-1.webp'),
      t('api_openai_gpt_image_2_image_edit-1.webp'),
      t('api_openai_fashion_billboard_generator-1.webp')
    ],
    runs: '760k runs · est.',
    price: 'from $0.06 / run · est.',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'Swap the label on this bottle to the attached design, keep the condensation.'
  },
  {
    slug: 'minimax-music-3',
    name: 'MiniMax Music 3',
    publisher: 'MiniMax',
    blurb:
      'Complete songs with structure — verse, chorus, and a mix you can direct.',
    modality: 'audio',
    kind: 'partner api',
    dayZero: true,
    img: t('audio_minimax_music_3-1.webp'),
    gallery: [
      t('audio_minimax_music_3-1.webp'),
      t('audio_ace_step1_5_xl_base-1.webp'),
      t('api_bytedance_seed_audio1_0_t2a-1.webp')
    ],
    runs: '190k runs · est.',
    price: 'from $0.06 / run · est.',
    launchUrl: 'https://comfy.org/minimax-music-3',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'A slow-burn synthwave track that opens on tape hiss and lands the chorus at 0:45.'
  },
  {
    slug: 'wan-animate-2',
    name: 'Wan Animate 2',
    publisher: 'Alibaba',
    blurb:
      'Character animation from a single reference. Open weights, day zero.',
    modality: 'i2v',
    kind: 'open weights',
    dayZero: true,
    img: t('api_wan2_7_video_edit-1.webp'),
    gallery: [
      t('api_wan2_7_video_edit-1.webp'),
      t('video_wan_vace_14B_ref2v-1.webp')
    ],
    runs: '420k runs · est.',
    price: 'from $0.05 / run · est.',
    launchUrl: 'https://comfy.org/wan-animate-2',
    workflowsUrl: 'https://comfy.org/workflows/model/wan',
    promptExample:
      'Turn this character sheet into a walk cycle, three-quarter view, cape drag included.'
  },
  {
    slug: 'qwen-image-edit',
    name: 'Qwen Image Edit',
    publisher: 'Qwen',
    blurb: 'Instruction-based image editing that holds identity across edits.',
    modality: 'edit',
    kind: 'open weights',
    img: t('image_qwen_Image_2512-1.webp'),
    gallery: [
      t('image_qwen_Image_2512-1.webp'),
      t('api_qwen3_image_edit-1.webp'),
      t('api_qwen3_t2i-1.webp')
    ],
    runs: '1.1M runs · est.',
    price: 'from $0.01 / run · est.',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'Same person, same light — swap the denim jacket for a wool coat.'
  },
  {
    slug: 'kling-2-6',
    name: 'Kling 2.6',
    publisher: 'Kling AI',
    blurb: 'Cinematic motion with pose and camera guidance, via partner nodes.',
    modality: 'i2v',
    kind: 'partner api',
    img: t('api_kling2_6_i2v-1.webp'),
    gallery: [
      t('api_kling2_6_i2v-1.webp'),
      t('api_kling_motion_control-1.webp'),
      t('api_kling_avatar2-1.webp')
    ],
    runs: '380k runs · est.',
    price: 'from $0.12 / run · est.',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'Match this storyboard: she turns from the window as the train passes behind.'
  }
]

// Ordered by Jan–May 2026 partner spend (Wan → Hunyuan → Topaz → xAI → MiniMax).
// Figures intentionally not displayed.
export const topPartnerApis: LaunchModel[] = [
  launches.find((l) => l.slug === 'wan-3-0')!,
  {
    slug: 'hunyuan-3d',
    name: 'Hunyuan 3D',
    publisher: 'Tencent',
    blurb: 'Image to textured 3D mesh, ready for your pipeline.',
    modality: '3d',
    kind: 'partner api',
    img: t('3d_hunyuan3d_image_to_model-1.webp'),
    gallery: [
      t('3d_hunyuan3d_image_to_model-1.webp'),
      t('3d_triposplat_image_to_gaussian_splat-1.webp')
    ],
    runs: '210k runs · est.',
    price: 'from $0.15 / run · est.',
    workflowsUrl: 'https://comfy.org/workflows',
    promptExample:
      'This sneaker photo → a clean, watertight mesh with PBR textures.'
  },
  launches.find((l) => l.slug === 'grok-imagine-2')!,
  launches.find((l) => l.slug === 'gpt-image-2')!
]

export interface UseCaseCard {
  title: string
  desc: string
  img: string
  href: string
  count: string
}

export const useCaseWorkflows: UseCaseCard[] = [
  {
    title: 'Product shots',
    desc: 'Studio-grade shots from one phone photo. Relight, stage, upscale.',
    img: t('api_openai_fashion_billboard_generator-1.webp'),
    href: 'https://comfy.org/workflows',
    count: '48 workflows'
  },
  {
    title: 'AI face swap',
    desc: 'Identity held across shots, edits, and angles.',
    img: t('api_kling_avatar2-1.webp'),
    href: 'https://comfy.org/workflows',
    count: '22 workflows'
  },
  {
    title: 'Expand image',
    desc: 'Outpaint beyond the frame in the same style.',
    img: t('api_bfl_flux1_expand_image-1.webp'),
    href: 'https://comfy.org/workflows',
    count: '18 workflows'
  },
  {
    title: 'Relight',
    desc: 'Golden hour on demand. Any photo, any light.',
    img: t('api_beeble_switchx_image_edit-1.webp'),
    href: 'https://comfy.org/workflows',
    count: '16 workflows'
  },
  {
    title: 'Character sheets',
    desc: 'One reference in, consistent character out — every angle.',
    img: t('Image_capybara_v0_1_text_to_image-1.webp'),
    href: 'https://comfy.org/workflows',
    count: '26 workflows'
  },
  {
    title: 'Image to video',
    desc: 'Animate any still with motion you control.',
    img: t('api_bfl_flux3_i2v-1.webp'),
    href: 'https://comfy.org/workflows/tag/image-to-video',
    count: '31 workflows'
  },
  {
    title: 'Upscale 4K',
    desc: 'Detail without artifacts. Batch-ready.',
    img: t('image_flux2-1.webp'),
    href: 'https://comfy.org/workflows',
    count: '14 workflows'
  },
  {
    title: 'Music + audio',
    desc: 'Full tracks and sound design with structure you direct.',
    img: t('audio_minimax_music_3-1.webp'),
    href: 'https://comfy.org/workflows',
    count: '9 workflows'
  }
]

export const dirLabel: Record<string, string> = {
  diffusion_models: 'Diffusion',
  checkpoints: 'Checkpoint',
  loras: 'LoRA',
  controlnet: 'ControlNet',
  clip_vision: 'CLIP Vision',
  model_patches: 'Patch',
  vae: 'VAE',
  text_encoders: 'Text encoder',
  audio_encoders: 'Audio encoder',
  latent_upscale_models: 'Latent upscale',
  upscale_models: 'Upscale',
  style_models: 'Style',
  partner_nodes: 'Partner node'
}

export const registryModels = models

export const fallbackImg = t('video_wan_vace_14B_ref2v-1.webp')
