export type LocalBuildPath = 'ready' | 'failed' | 'fixed' | 'cancelled'

export interface LocalBuildItem {
  name: string
  gb: number
  unused: boolean
}

export interface LocalBuildGpu {
  name: string
  vramGb: number
  pricePerHour: number
}

const PATHS: readonly LocalBuildPath[] = [
  'ready',
  'failed',
  'fixed',
  'cancelled'
]

export const LOCAL_BUILD_PATH_PARAM = 'localBuild'

export function readLocalBuildPath(
  search: string = window.location.search
): LocalBuildPath | undefined {
  const value = new URLSearchParams(search).get(LOCAL_BUILD_PATH_PARAM)
  return PATHS.find((path) => path === value)
}

export function isLocalBuildPrototype(): boolean {
  return readLocalBuildPath() !== undefined
}

export const DEFAULT_BUILD_NAME = 'portrait-upscale'

export const STORAGE_PRICE_PER_GB_MONTH = 0.1

export const BUILD_ERROR =
  'Cannot install torch==2.8.0 and xformers==0.0.28.post1'

export const CUSTOM_NODES: readonly LocalBuildItem[] = [
  { name: 'ComfyUI Impact Pack', gb: 0.182, unused: false },
  { name: 'KJNodes for ComfyUI', gb: 0.041, unused: false },
  { name: 'ControlNet Auxiliary Preprocessors', gb: 0.096, unused: false },
  { name: 'rgthree-comfy', gb: 0.012, unused: false },
  { name: 'Video Helper Suite', gb: 0.027, unused: false },
  { name: 'ComfyUI Essentials', gb: 0.009, unused: false },
  { name: 'ComfyUI Easy Use', gb: 0.064, unused: false },
  { name: 'ComfyUI IPAdapter Plus', gb: 0.018, unused: false },
  { name: 'WAS Node Suite', gb: 0.071, unused: true },
  { name: 'AnimateDiff Evolved', gb: 0.035, unused: true },
  { name: 'ComfyUI Custom Scripts', gb: 0.006, unused: false },
  { name: 'Ultimate SD Upscale', gb: 0.004, unused: false },
  { name: 'Efficiency Nodes', gb: 0.011, unused: false },
  { name: 'ComfyUI Frame Interpolation', gb: 0.058, unused: true },
  { name: 'Advanced ControlNet', gb: 0.015, unused: false },
  { name: 'ComfyUI Inspire Pack', gb: 0.023, unused: false }
]

export const MODELS: readonly LocalBuildItem[] = [
  { name: 'flux1-dev-fp8.safetensors', gb: 17.2, unused: false },
  { name: 'juggernautXL_v9.safetensors', gb: 6.6, unused: false },
  { name: 'sd_xl_base_1.0.safetensors', gb: 6.5, unused: true },
  { name: 'qwen_image_2.1_fp8.safetensors', gb: 10.2, unused: false },
  { name: 'wan2.1_t2v_14B_fp8.safetensors', gb: 14.3, unused: true },
  { name: 'z_image_turbo_bf16.safetensors', gb: 12.3, unused: true },
  { name: 't5xxl_fp8_e4m3fn.safetensors', gb: 4.9, unused: false },
  { name: 'umt5_xxl_fp8.safetensors', gb: 6.7, unused: false },
  { name: 'clip_l.safetensors', gb: 0.246, unused: false },
  { name: 'ae.safetensors', gb: 0.335, unused: false },
  { name: 'sdxl_vae.safetensors', gb: 0.335, unused: false },
  { name: 'wan_2.1_vae.safetensors', gb: 0.254, unused: false },
  { name: 'portrait_detail_v2.safetensors', gb: 0.228, unused: false },
  { name: 'film_grain_xl.safetensors', gb: 0.171, unused: false },
  { name: 'diffusers_xl_canny_full.safetensors', gb: 2.5, unused: false },
  { name: 'control_v11p_sd15_openpose.pth', gb: 1.4, unused: false },
  { name: 'ip-adapter-plus_sdxl_vit-h.safetensors', gb: 0.848, unused: false },
  { name: 'clip_vision_h.safetensors', gb: 1.3, unused: false },
  { name: '4x-UltraSharp.pth', gb: 0.064, unused: false },
  { name: 'RealESRGAN_x4plus.pth', gb: 0.064, unused: false }
]

export const GPUS: readonly LocalBuildGpu[] = [
  { name: 'RTX 5090', vramGb: 32, pricePerHour: 1.58 },
  { name: 'RTX PRO 6000', vramGb: 96, pricePerHour: 3.49 },
  { name: 'H100', vramGb: 80, pricePerHour: 4.79 },
  { name: 'H200', vramGb: 141, pricePerHour: 7.7 },
  { name: 'B200', vramGb: 180, pricePerHour: 8.64 }
]

export const DEFAULT_GPU_INDEX = 1

export const STEP_MS = {
  upload: 4000,
  build: 4000,
  deploy: 3000,
  agentFix: 3000,
  autoClose: 5000
} as const

export function formatSize(gb: number): string {
  return gb < 1 ? `${Math.round(gb * 1000)} MB` : `${gb.toFixed(1)} GB`
}

export function formatPrice(dollars: number): string {
  return `$${dollars.toFixed(2)}`
}

export function sortForReview(
  items: readonly LocalBuildItem[]
): LocalBuildItem[] {
  return [...items].sort(
    (a, b) => Number(b.unused) - Number(a.unused) || b.gb - a.gb
  )
}
