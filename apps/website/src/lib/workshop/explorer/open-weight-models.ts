import { WORKSHOP_INCLUDED } from 'astro:env/client'

import { modelFileHref } from '@/lib/workshop/model-file-href'
import type { UseCase } from '@/config/models-catalogue'

/**
 * Stand-in for the model explorer's open-weight listing until it ships. Each
 * entry points at a model file page that is already published.
 */
export interface OpenWeightModel {
  readonly slug: string
  readonly name: string
  readonly provider: string
  readonly useCase: UseCase
  readonly thumbnailUrl: string
}

const TEMPLATES =
  'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/'

export const OPEN_WEIGHT_MODELS: readonly OpenWeightModel[] = [
  {
    slug: 'flux1-dev',
    name: 'Flux.1 Dev',
    provider: 'Black Forest Labs',
    useCase: 'generate-images',
    thumbnailUrl: `${TEMPLATES}flux_dev_checkpoint_example-1.webp`
  },
  {
    slug: 'flux1-schnell',
    name: 'Flux.1 Schnell',
    provider: 'Black Forest Labs',
    useCase: 'generate-images',
    thumbnailUrl: `${TEMPLATES}flux_schnell_full_text_to_image-1.webp`
  },
  {
    slug: 'flux1-dev-kontext-fp8-scaled',
    name: 'Flux.1 Kontext Dev',
    provider: 'Black Forest Labs',
    useCase: 'edit-images',
    thumbnailUrl: `${TEMPLATES}flux_kontext_dev_basic-1.webp`
  },
  {
    slug: 'qwen-image-fp8-e4m3fn',
    name: 'Qwen Image',
    provider: 'Qwen',
    useCase: 'generate-images',
    thumbnailUrl: `${TEMPLATES}image_qwen_image-1.webp`
  },
  {
    slug: 'qwen-image-edit-2511-bf16',
    name: 'Qwen Image Edit 2511',
    provider: 'Qwen',
    useCase: 'edit-images',
    thumbnailUrl: `${TEMPLATES}image-qwen_image_edit_2511_lora_inflation-1.webp`
  },
  {
    slug: 'hidream-i1-full-fp8',
    name: 'HiDream I1 Full',
    provider: 'HiDream',
    useCase: 'generate-images',
    thumbnailUrl: `${TEMPLATES}hidream_i1_full-1.webp`
  },
  {
    slug: 'z-image-turbo-bf16',
    name: 'Z-Image Turbo',
    provider: 'Tongyi',
    useCase: 'generate-images',
    thumbnailUrl: `${TEMPLATES}basic_switch_node-1.webp`
  },
  {
    slug: 'sd3-5-large-fp8-scaled',
    name: 'Stable Diffusion 3.5 Large',
    provider: 'Stability AI',
    useCase: 'generate-images',
    thumbnailUrl: `${TEMPLATES}sd3.5_large_blur-1.webp`
  },
  {
    slug: 'wan2-2-ti2v-5b-fp16',
    name: 'Wan 2.2 5B',
    provider: 'Wan',
    useCase: 'generate-videos',
    thumbnailUrl: `${TEMPLATES}video_wan2_2_5B_ti2v-1.webp`
  },
  {
    slug: 'wan2-2-i2v-high-noise-14b-fp8-scaled',
    name: 'Wan 2.2 Image to Video 14B',
    provider: 'Wan',
    useCase: 'animate-images',
    thumbnailUrl: `${TEMPLATES}template_rob_split_stack_qwen_multi_wan22-1.webp`
  },
  {
    slug: 'ltx-2-3-22b-dev',
    name: 'LTX-2.3',
    provider: 'Lightricks',
    useCase: 'generate-videos',
    thumbnailUrl: `${TEMPLATES}template_ltx2_3_lora_remove_subtitles_from_video-1.webp`
  },
  {
    slug: 'hunyuanvideo1-5-720p-t2v-fp16',
    name: 'HunyuanVideo 1.5',
    provider: 'Tencent',
    useCase: 'generate-videos',
    thumbnailUrl: `${TEMPLATES}video_hunyuan_video_1.5_720p_t2v-1.webp`
  }
]

export function openWeightHref(model: Pick<OpenWeightModel, 'slug'>): string {
  return modelFileHref(model.slug, WORKSHOP_INCLUDED)
}

export function filterOpenWeightModels(
  list: readonly OpenWeightModel[],
  {
    query = '',
    useCases = []
  }: { query?: string; useCases?: readonly UseCase[] }
): OpenWeightModel[] {
  const needle = query.trim().toLowerCase()
  return list.filter(
    (model) =>
      (useCases.length === 0 || useCases.includes(model.useCase)) &&
      (needle === '' ||
        [model.name, model.provider, model.useCase.replaceAll('-', ' ')]
          .join(' ')
          .toLowerCase()
          .includes(needle))
  )
}
