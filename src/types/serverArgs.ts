export enum LatentPreviewMethod {
  NoPreviews = 'none',
  Auto = 'auto',
  Latent2RGB = 'latent2rgb',
  TAESD = 'taesd'
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export enum HashFunction {
  MD5 = 'md5',
  SHA1 = 'sha1',
  SHA256 = 'sha256',
  SHA512 = 'sha512'
}

export interface ComfyUIServerConfig {
  // Network settings
  listen?: string // default: "127.0.0.1"
  port: number // default: 8188
  tlsKeyfile?: string
  tlsCertfile?: string
  enableCorsHeader?: string // default: undefined, when enabled without value: "*"
  maxUploadSize: number // default: 100 (MB)

  // Directory settings
  extraModelPathsConfig?: string[]
  outputDirectory?: string
  tempDirectory?: string
  inputDirectory?: string
  userDirectory?: string

  // Launch behavior
  autoLaunch: boolean
  disableAutoLaunch: boolean

  // CUDA settings
  cudaDevice?: number
  cudaMalloc: boolean
  disableCudaMalloc: boolean

  // Precision settings
  forceFp32: boolean
  forceFp16: boolean

  // UNET precision
  bf16Unet: boolean
  fp16Unet: boolean
  fp8E4m3fnUnet: boolean
  fp8E5m2Unet: boolean

  // VAE settings
  fp16Vae: boolean
  fp32Vae: boolean
  bf16Vae: boolean
  cpuVae: boolean

  // Text Encoder settings
  fp8E4m3fnTextEnc: boolean
  fp8E5m2TextEnc: boolean
  fp16TextEnc: boolean
  fp32TextEnc: boolean

  // Memory and performance settings
  forceChannelsLast: boolean
  directml?: number
  disableIpexOptimize: boolean
  previewMethod: LatentPreviewMethod
  previewSize: number

  // Cache settings
  cacheClassic: boolean
  cacheLru: number // default: 0

  // Attention settings
  useSplitCrossAttention: boolean
  useQuadCrossAttention: boolean
  usePytorchCrossAttention: boolean
  disableXformers: boolean
  forceUpcastAttention: boolean
  dontUpcastAttention: boolean

  // VRAM management
  gpuOnly: boolean
  highvram: boolean
  normalvram: boolean
  lowvram: boolean
  novram: boolean
  cpu: boolean
  reserveVram?: number

  // Misc settings
  defaultHashingFunction: HashFunction
  disableSmartMemory: boolean
  deterministic: boolean
  fast: boolean
  dontPrintServer: boolean
  quickTestForCi: boolean
  windowsStandaloneBuild: boolean
  disableMetadata: boolean
  disableAllCustomNodes: boolean
  multiUser: boolean
  verbose: LogLevel

  // Frontend settings
  frontEndVersion: string // default: "comfyanonymous/ComfyUI@latest"
  frontEndRoot?: string
}

export const DEFAULT_SERVER_CONFIG: ComfyUIServerConfig = {
  // Network settings
  listen: '127.0.0.1',
  port: 8188,
  tlsKeyfile: undefined,
  tlsCertfile: undefined,
  enableCorsHeader: undefined,
  maxUploadSize: 100,

  // Directory settings
  extraModelPathsConfig: undefined,
  outputDirectory: undefined,
  tempDirectory: undefined,
  inputDirectory: undefined,
  userDirectory: undefined,

  // Launch behavior
  autoLaunch: false,
  disableAutoLaunch: false,

  // CUDA settings
  cudaDevice: undefined,
  cudaMalloc: false,
  disableCudaMalloc: false,

  // Precision settings
  forceFp32: false,
  forceFp16: false,

  // UNET precision
  bf16Unet: false,
  fp16Unet: false,
  fp8E4m3fnUnet: false,
  fp8E5m2Unet: false,

  // VAE settings
  fp16Vae: false,
  fp32Vae: false,
  bf16Vae: false,
  cpuVae: false,

  // Text Encoder settings
  fp8E4m3fnTextEnc: false,
  fp8E5m2TextEnc: false,
  fp16TextEnc: false,
  fp32TextEnc: false,

  // Memory and performance settings
  forceChannelsLast: false,
  directml: undefined,
  disableIpexOptimize: false,
  previewMethod: LatentPreviewMethod.NoPreviews,
  previewSize: 512,

  // Cache settings
  cacheClassic: false,
  cacheLru: 0,

  // Attention settings
  useSplitCrossAttention: false,
  useQuadCrossAttention: false,
  usePytorchCrossAttention: false,
  disableXformers: false,
  forceUpcastAttention: false,
  dontUpcastAttention: false,

  // VRAM management
  gpuOnly: false,
  highvram: false,
  normalvram: false,
  lowvram: false,
  novram: false,
  cpu: false,
  reserveVram: undefined,

  // Misc settings
  defaultHashingFunction: HashFunction.SHA256,
  disableSmartMemory: false,
  deterministic: false,
  fast: false,
  dontPrintServer: false,
  quickTestForCi: false,
  windowsStandaloneBuild: false,
  disableMetadata: false,
  disableAllCustomNodes: false,
  multiUser: false,
  verbose: LogLevel.INFO,

  // Frontend settings
  frontEndVersion: 'comfyanonymous/ComfyUI@latest',
  frontEndRoot: undefined
} as const
