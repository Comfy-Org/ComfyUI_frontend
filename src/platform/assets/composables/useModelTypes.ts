import { createSharedComposable, useAsyncState } from '@vueuse/core'

import { api } from '@/scripts/api'

/**
 * Format folder name to display name
 * Converts "upscale_models" -> "Upscale Model"
 * Converts "loras" -> "LoRA"
 */
function formatDisplayName(folderName: string): string {
  // Chinese display names
  const chineseNames: Record<string, string> = {
    checkpoints: '基础模型 (Checkpoints)',
    loras: '微调模型 (LoRA)',
    vae: '编解码器 (VAE)',
    text_encoders: '文本编码器',
    diffusion_models: '扩散模型',
    clip_vision: '视觉理解 (CLIP Vision)',
    style_models: '风格模型',
    embeddings: '嵌入向量',
    diffusers: '扩散器',
    vae_approx: 'VAE 近似',
    controlnet: '控制网络 (ControlNet)',
    gligen: '定位生成 (GLIGEN)',
    upscale_models: '超分模型 (Upscale)',
    latent_upscale_models: 'Latent 超分模型',
    hypernetworks: '超网络',
    photomaker: '照片生成器',
    classifiers: '分类器',
    model_patches: '模型补丁',
    audio_encoders: '音频编码器',
    frame_interpolation: '帧插值',
    download_model_base: '模型下载目录',
    ipadapter: '图像适配器 (IP-Adapter)',
    sams: '分割模型 (SAM)',
    animatediff_motion_lora: '动画差分运动 LoRA',
    animatediff_models: '动画差分模型',
    sam2: '分割模型 2 (SAM 2)',
    insightface: '人脸识别 (InsightFace)',
    unet: 'UNet',
    configs: '配置文件',
  }
  if (chineseNames[folderName]) return chineseNames[folderName]

  // Fallback: format from underscore to title case
  return folderName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Descriptions for model folders - shown as tooltips
 */
export function getModelFolderDescription(folderName: string): string {
  const descriptions: Record<string, string> = {
    checkpoints: '主模型文件，存放 Stable Diffusion 等基础模型，是图像生成的核心',
    loras: '低秩适配模型，用于微调风格、角色、姿势等特定效果',
    vae: '变分自编码器，负责图像编解码，影响色彩和细节',
    text_encoders: '文本编码器模型，将文字提示转换为 AI 能理解的向量',
    diffusion_models: '扩散模型文件，用于扩散过程的模型参数',
    clip_vision: '视觉理解模型，用于图像反推提示词和风格参考',
    style_models: '风格模型，用于控制生成图像的风格和画风',
    embeddings: '文本嵌入向量，存放 Textual Inversion 等嵌入文件',
    controlnet: '控制网络模型，用于精确控制图像构图、姿势、深度等',
    upscale_models: '图像超分放大模型，用于提升图像分辨率',
    vae_approx: 'VAE 近似模型，用于快速预览时的临时编解码',
    hypernetworks: '超网络模型，一种轻量级的模型微调方式',
    gligen: '空间定位生成模型，可根据边界框控制物体位置',
    unet: 'UNet 架构模型，扩散模型的核心去噪网络',
  }
  return descriptions[folderName] || '存放 ' + formatDisplayName(folderName) + ' 相关模型文件'
}

interface ModelTypeOption {
  name: string // Display name
  value: string // Actual tag value
}

const DISALLOWED_MODEL_TYPES = ['nlf'] as const

/**
 * Composable for fetching and managing model types from the API
 * Uses shared state to ensure data is only fetched once
 */
export const useModelTypes = createSharedComposable(() => {
  const {
    state: modelTypes,
    isReady,
    isLoading,
    error,
    execute
  } = useAsyncState(
    async (): Promise<ModelTypeOption[]> => {
      const response = await api.getModelFolders()
      return response
        .filter(
          (folder) =>
            !DISALLOWED_MODEL_TYPES.includes(
              folder.name as (typeof DISALLOWED_MODEL_TYPES)[number]
            )
        )
        .map((folder) => ({
          name: formatDisplayName(folder.name),
          value: folder.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    [] as ModelTypeOption[],
    {
      immediate: false,
      onError: (err) => {
        console.error('Failed to fetch model types:', err)
      }
    }
  )

  async function fetchModelTypes() {
    if (isReady.value || isLoading.value) return
    await execute()
  }

  return {
    modelTypes,
    isLoading,
    error,
    fetchModelTypes
  }
})
