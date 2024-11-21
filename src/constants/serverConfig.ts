import { FormItem } from '@/types/settingTypes'
import {
  LatentPreviewMethod,
  LogLevel,
  HashFunction,
  AutoLaunch,
  CudaMalloc,
  FloatingPointPrecision,
  CrossAttentionMethod,
  VramManagement
} from '@/types/serverArgs'

export interface ServerConfig<T> extends FormItem {
  id: string
  defaultValue: T
  category?: string[]
  // Override the default value getter with a custom function.
  getValue?: (value: T) => Record<string, any>
}

export const SERVER_CONFIG_ITEMS: ServerConfig<any>[] = [
  // Network settings
  {
    id: 'listen',
    name: 'Host: The IP address to listen on',
    category: ['network'],
    type: 'text',
    defaultValue: '127.0.0.1'
  },
  {
    id: 'port',
    name: 'Port: The port to listen on',
    category: ['network'],
    type: 'number',
    defaultValue: 8188
  },
  {
    id: 'tls-keyfile',
    name: 'TLS Key File: Path to TLS key file for HTTPS',
    category: ['network'],
    type: 'text',
    defaultValue: undefined
  },
  {
    id: 'tls-certfile',
    name: 'TLS Certificate File: Path to TLS certificate file for HTTPS',
    category: ['network'],
    type: 'text',
    defaultValue: undefined
  },
  {
    id: 'enable-cors-header',
    name: 'Enable CORS header: Use "*" for all origins or specify domain',
    category: ['network'],
    type: 'text',
    defaultValue: undefined
  },
  {
    id: 'max-upload-size',
    name: 'Maximum upload size (MB)',
    category: ['network'],
    type: 'number',
    defaultValue: 100
  },

  // Launch behavior
  {
    id: 'auto-launch',
    name: 'Automatically opens in the browser on startup',
    category: ['launch'],
    type: 'combo',
    options: Object.values(AutoLaunch),
    defaultValue: AutoLaunch.Auto,
    getValue: (value: AutoLaunch) => {
      switch (value) {
        case AutoLaunch.Auto:
          return {}
        case AutoLaunch.Enable:
          return {
            ['auto-launch']: true
          }
        case AutoLaunch.Disable:
          return {
            ['disable-auto-launch']: true
          }
      }
    }
  },

  // CUDA settings
  {
    id: 'cuda-device',
    name: 'CUDA device index to use',
    category: ['CUDA'],
    type: 'number',
    defaultValue: undefined
  },
  {
    id: 'cuda-malloc',
    name: 'Use CUDA malloc for memory allocation',
    category: ['CUDA'],
    type: 'combo',
    options: Object.values(CudaMalloc),
    defaultValue: CudaMalloc.Auto,
    getValue: (value: CudaMalloc) => {
      switch (value) {
        case CudaMalloc.Auto:
          return {}
        case CudaMalloc.Enable:
          return {
            ['cuda-malloc']: true
          }
        case CudaMalloc.Disable:
          return {
            ['disable-cuda-malloc']: true
          }
      }
    }
  },

  // Precision settings
  {
    id: 'global-precision',
    name: 'Global floating point precision',
    category: ['inference'],
    type: 'combo',
    options: [
      FloatingPointPrecision.AUTO,
      FloatingPointPrecision.FP32,
      FloatingPointPrecision.FP16
    ],
    defaultValue: FloatingPointPrecision.AUTO,
    tooltip: 'Global floating point precision',
    getValue: (value: FloatingPointPrecision) => {
      switch (value) {
        case FloatingPointPrecision.AUTO:
          return {}
        case FloatingPointPrecision.FP32:
          return {
            ['force-fp32']: true
          }
        case FloatingPointPrecision.FP16:
          return {
            ['force-fp16']: true
          }
        default:
          return {}
      }
    }
  },

  // UNET precision
  {
    id: 'unet-precision',
    name: 'UNET precision',
    category: ['inference'],
    type: 'combo',
    options: [
      FloatingPointPrecision.AUTO,
      FloatingPointPrecision.FP16,
      FloatingPointPrecision.BF16,
      FloatingPointPrecision.FP8E4M3FN,
      FloatingPointPrecision.FP8E5M2
    ],
    defaultValue: FloatingPointPrecision.AUTO,
    tooltip: 'UNET precision',
    getValue: (value: FloatingPointPrecision) => {
      switch (value) {
        case FloatingPointPrecision.AUTO:
          return {}
        default:
          return {
            [`${value.toLowerCase()}-unet`]: true
          }
      }
    }
  },

  // VAE settings
  {
    id: 'vae-precision',
    name: 'VAE precision',
    category: ['inference'],
    type: 'combo',
    options: [
      FloatingPointPrecision.AUTO,
      FloatingPointPrecision.FP16,
      FloatingPointPrecision.FP32,
      FloatingPointPrecision.BF16
    ],
    defaultValue: FloatingPointPrecision.AUTO,
    tooltip: 'VAE precision',
    getValue: (value: FloatingPointPrecision) => {
      switch (value) {
        case FloatingPointPrecision.AUTO:
          return {}
        default:
          return {
            [`${value.toLowerCase()}-vae`]: true
          }
      }
    }
  },
  {
    id: 'cpu-vae',
    name: 'Run VAE on CPU',
    category: ['inference'],
    type: 'boolean',
    defaultValue: false
  },

  // Text Encoder settings
  {
    id: 'text-encoder-precision',
    name: 'Text Encoder precision',
    category: ['inference'],
    type: 'combo',
    options: [
      FloatingPointPrecision.AUTO,
      FloatingPointPrecision.FP8E4M3FN,
      FloatingPointPrecision.FP8E5M2,
      FloatingPointPrecision.FP16,
      FloatingPointPrecision.FP32
    ],
    defaultValue: FloatingPointPrecision.AUTO,
    tooltip: 'Text Encoder precision',
    getValue: (value: FloatingPointPrecision) => {
      switch (value) {
        case FloatingPointPrecision.AUTO:
          return {}
        default:
          return {
            [`${value.toLowerCase()}-text-enc`]: true
          }
      }
    }
  },

  // Memory and performance settings
  {
    id: 'force-channels-last',
    name: 'Force channels-last memory format',
    category: ['memory'],
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'directml',
    name: 'DirectML device index',
    category: ['memory'],
    type: 'number',
    defaultValue: undefined
  },
  {
    id: 'disable-ipex-optimize',
    name: 'Disable IPEX optimization',
    category: ['memory'],
    type: 'boolean',
    defaultValue: false
  },

  // Preview settings
  {
    id: 'preview-method',
    name: 'Method used for latent previews',
    category: ['preview'],
    type: 'combo',
    options: Object.values(LatentPreviewMethod),
    defaultValue: LatentPreviewMethod.NoPreviews
  },
  {
    id: 'preview-size',
    name: 'Size of preview images',
    category: ['preview'],
    type: 'number',
    defaultValue: 512
  },

  // Cache settings
  {
    id: 'cache-classic',
    name: 'Use classic cache system',
    category: ['Cache'],
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'cache-lru',
    name: 'Use LRU caching with a maximum of N node results cached. May use more RAM/VRAM (0 to disable).',
    category: ['Cache'],
    type: 'number',
    defaultValue: 0
  },

  // Attention settings
  {
    id: 'cross-attention-method',
    name: 'Cross attention method',
    category: ['attention'],
    type: 'combo',
    options: Object.values(CrossAttentionMethod),
    defaultValue: CrossAttentionMethod.Auto,
    getValue: (value: CrossAttentionMethod) => {
      switch (value) {
        case CrossAttentionMethod.Auto:
          return {}
        default:
          return {
            [`use-${value.toLowerCase()}-cross-attention`]: true
          }
      }
    }
  },
  {
    id: 'disable-xformers',
    name: 'Disable xFormers optimization',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'force-upcast-attention',
    name: 'Force attention upcast',
    category: ['attention'],
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'dont-upcast-attention',
    name: 'Prevent attention upcast',
    category: ['attention'],
    type: 'boolean',
    defaultValue: false
  },

  // VRAM management
  {
    id: 'vram-management',
    name: 'VRAM management mode',
    category: ['memory'],
    type: 'combo',
    options: Object.values(VramManagement),
    defaultValue: VramManagement.Auto,
    getValue: (value: VramManagement) => {
      switch (value) {
        case VramManagement.Auto:
          return {}
        default:
          return {
            [value]: true
          }
      }
    }
  },
  {
    id: 'reserve-vram',
    name: 'Reserved VRAM (GB)',
    category: ['memory'],
    type: 'number',
    defaultValue: undefined,
    tooltip:
      'Set the amount of vram in GB you want to reserve for use by your OS/other software. By default some amount is reverved depending on your OS.'
  },

  // Misc settings
  {
    id: 'default-hashing-function',
    name: 'Default hashing function for model files',
    category: ['misc'],
    type: 'combo',
    options: Object.values(HashFunction),
    defaultValue: HashFunction.SHA256
  },
  {
    id: 'disable-smart-memory',
    name: 'Force ComfyUI to agressively offload to regular ram instead of keeping models in vram when it can.',
    category: ['memory'],
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'deterministic',
    name: 'Make pytorch use slower deterministic algorithms when it can.',
    category: ['misc'],
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Note that this might not make images deterministic in all cases.'
  },
  {
    id: 'fast',
    name: 'Enable some untested and potentially quality deteriorating optimizations.',
    category: ['misc'],
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'dont-print-server',
    name: "Don't print server output to console.",
    category: ['misc'],
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'disable-metadata',
    name: 'Disable saving prompt metadata in files.',
    category: ['misc'],
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'disable-all-custom-nodes',
    name: 'Disable loading all custom nodes.',
    category: ['misc'],
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'log-level',
    name: 'Logging verbosity level',
    category: ['misc'],
    type: 'combo',
    options: Object.values(LogLevel),
    defaultValue: LogLevel.INFO,
    getValue: (value: LogLevel) => {
      return {
        verbose: value
      }
    }
  },

  // Frontend settings
  {
    id: 'front-end-version',
    name: 'Frontend implementation',
    category: ['frontend'],
    type: 'text',
    defaultValue: 'comfyanonymous/ComfyUI@latest',
    tooltip: `Specifies the version of the frontend to be used. This command needs internet connectivity to query and
    download available frontend implementations from GitHub releases.

    The version string should be in the format of:
    [repoOwner]/[repoName]@[version]
    where version is one of: "latest" or a valid version number (e.g. "1.0.0")`
  }
]
