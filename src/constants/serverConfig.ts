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
  defaultValue: T
  category?: string[]
  // Override the default value getter with a custom function.
  getValue?: (value: T) => Record<string, any>
}

export const SERVER_CONFIG_ITEMS: ServerConfig<any>[] = [
  // Network settings
  {
    name: 'listen',
    category: ['network'],
    type: 'text',
    defaultValue: '127.0.0.1',
    tooltip: 'The IP address to listen on'
  },
  {
    name: 'port',
    category: ['network'],
    type: 'number',
    defaultValue: 8188,
    tooltip: 'The port to listen on'
  },
  {
    name: 'tls-keyfile',
    category: ['network'],
    type: 'text',
    defaultValue: undefined,
    tooltip: 'Path to TLS key file for HTTPS'
  },
  {
    name: 'tls-certfile',
    category: ['network'],
    type: 'text',
    defaultValue: undefined,
    tooltip: 'Path to TLS certificate file for HTTPS'
  },
  {
    name: 'enable-cors-header',
    category: ['network'],
    type: 'text',
    defaultValue: undefined,
    tooltip: 'Enable CORS header. Use "*" for all origins or specify domain'
  },
  {
    name: 'max-upload-size',
    category: ['network'],
    type: 'number',
    defaultValue: 100,
    tooltip: 'Maximum upload size in MB'
  },

  // Directory settings
  {
    name: 'extra-model-paths-config',
    category: ['directory'],
    type: 'text',
    defaultValue: undefined,
    tooltip: 'Additional paths to search for models'
  },
  {
    name: 'output-directory',
    category: ['directory'],
    type: 'text',
    defaultValue: undefined,
    tooltip: 'Directory for output files'
  },
  {
    name: 'temp-directory',
    category: ['directory'],
    type: 'text',
    defaultValue: undefined,
    tooltip: 'Directory for temporary files'
  },
  {
    name: 'input-directory',
    category: ['directory'],
    type: 'text',
    defaultValue: undefined,
    tooltip: 'Directory for input files'
  },
  {
    name: 'user-directory',
    category: ['directory'],
    type: 'text',
    defaultValue: undefined,
    tooltip: 'Directory for user files'
  },

  // Launch behavior
  {
    name: 'auto-launch',
    category: ['launch'],
    type: 'combo',
    options: Object.values(AutoLaunch),
    defaultValue: AutoLaunch.Auto,
    tooltip: 'Automatically launch the server',
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
    name: 'cuda-device',
    category: ['CUDA'],
    type: 'number',
    defaultValue: undefined,
    tooltip: 'CUDA device index to use'
  },
  {
    name: 'cuda-malloc',
    category: ['CUDA'],
    type: 'combo',
    options: Object.values(CudaMalloc),
    defaultValue: CudaMalloc.Auto,
    tooltip: 'Use CUDA malloc for memory allocation',
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
    name: 'global-precision',
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
    name: 'unet-precision',
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
    name: 'vae-precision',
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
    name: 'cpu-vae',
    category: ['inference'],
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Run VAE on CPU'
  },

  // Text Encoder settings
  {
    name: 'text-encoder-precision',
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
    name: 'force-channels-last',
    category: ['memory'],
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Force channels-last memory format'
  },
  {
    name: 'directml',
    category: ['memory'],
    type: 'number',
    defaultValue: undefined,
    tooltip: 'DirectML device index'
  },
  {
    name: 'disable-ipex-optimize',
    category: ['memory'],
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Disable IPEX optimization'
  },

  // Preview settings
  {
    name: 'preview-method',
    category: ['preview'],
    type: 'combo',
    options: Object.values(LatentPreviewMethod),
    defaultValue: LatentPreviewMethod.NoPreviews,
    tooltip: 'Method used for latent previews'
  },
  {
    name: 'preview-size',
    category: ['preview'],
    type: 'number',
    defaultValue: 512,
    tooltip: 'Size of preview images'
  },

  // Cache settings
  {
    name: 'cache-classic',
    category: ['Cache'],
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Use classic cache system'
  },
  {
    name: 'cache-lru',
    category: ['Cache'],
    type: 'number',
    defaultValue: 0,
    tooltip:
      'Use LRU caching with a maximum of N node results cached. May use more RAM/VRAM (0 to disable).'
  },

  // Attention settings
  {
    name: 'cross-attention-method',
    category: ['attention'],
    type: 'combo',
    options: Object.values(CrossAttentionMethod),
    defaultValue: CrossAttentionMethod.Auto,
    tooltip: 'Cross attention method',
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
    name: 'disable-xformers',
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Disable xFormers optimization'
  },
  {
    name: 'force-upcast-attention',
    category: ['attention'],
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Force attention upcast'
  },
  {
    name: 'dont-upcast-attention',
    category: ['attention'],
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Prevent attention upcast'
  },

  // VRAM management
  {
    name: 'vram-management',
    category: ['memory'],
    type: 'combo',
    options: Object.values(VramManagement),
    defaultValue: VramManagement.Auto,
    tooltip: 'VRAM management mode',
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
    name: 'reserve-vram',
    category: ['memory'],
    type: 'number',
    defaultValue: undefined,
    tooltip:
      'Set the amount of vram in GB you want to reserve for use by your OS/other software. By default some amount is reverved depending on your OS.'
  },

  // Misc settings
  {
    name: 'default-hashing-function',
    type: 'combo',
    options: Object.values(HashFunction),
    defaultValue: HashFunction.SHA256,
    tooltip: 'Default hashing function for model files'
  },
  {
    name: 'disable-smart-memory',
    type: 'boolean',
    defaultValue: false,
    tooltip:
      'Force ComfyUI to agressively offload to regular ram instead of keeping models in vram when it can.'
  },
  {
    name: 'deterministic',
    type: 'boolean',
    defaultValue: false,
    tooltip:
      'Make pytorch use slower deterministic algorithms when it can. Note that this might not make images deterministic in all cases.'
  },
  {
    name: 'fast',
    type: 'boolean',
    defaultValue: false,
    tooltip:
      'Enable some untested and potentially quality deteriorating optimizations.'
  },
  {
    name: 'dont-print-server',
    type: 'boolean',
    defaultValue: false,
    tooltip: "Don't print server output to console."
  },
  {
    name: 'quick-test-for-ci',
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Quick test mode for CI'
  },
  {
    name: 'windows-standalone-build',
    type: 'boolean',
    defaultValue: false,
    tooltip:
      'Windows standalone build: Enable convenient things that most people using the standalone windows build will probably enjoy (like auto opening the page on startup)'
  },
  {
    name: 'disable-metadata',
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Disable saving prompt metadata in files.'
  },
  {
    name: 'disable-all-custom-nodes',
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Disable loading all custom nodes.'
  },
  {
    name: 'multi-user',
    type: 'boolean',
    defaultValue: false,
    tooltip: 'Enable multi-user mode'
  },
  {
    name: 'log-level',
    type: 'combo',
    options: Object.values(LogLevel),
    defaultValue: LogLevel.INFO,
    tooltip: 'Logging verbosity level',
    getValue: (value: LogLevel) => {
      return {
        verbose: value
      }
    }
  },

  // Frontend settings
  {
    name: 'front-end-version',
    type: 'text',
    defaultValue: 'comfyanonymous/ComfyUI@latest',
    tooltip: `Specifies the version of the frontend to be used. This command needs internet connectivity to query and
    download available frontend implementations from GitHub releases.

    The version string should be in the format of:
    [repoOwner]/[repoName]@[version]
    where version is one of: "latest" or a valid version number (e.g. "1.0.0")`
  }
]
