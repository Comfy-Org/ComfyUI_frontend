import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

/**
 * Base node definitions covering the default workflow.
 * Use {@link createMockNodeDefinitions} to extend with per-test overrides.
 */
const baseNodeDefinitions: Record<string, ComfyNodeDef> = {
  KSampler: {
    input: {
      required: {
        model: ['MODEL', {}],
        seed: [
          'INT',
          {
            default: 0,
            min: 0,
            max: 0xfffffffffffff,
            control_after_generate: true
          }
        ],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        cfg: ['FLOAT', { default: 8.0, min: 0.0, max: 100.0, step: 0.1 }],
        sampler_name: [['euler', 'euler_ancestral', 'heun', 'dpm_2'], {}],
        scheduler: [['normal', 'karras', 'exponential', 'simple'], {}],
        positive: ['CONDITIONING', {}],
        negative: ['CONDITIONING', {}],
        latent_image: ['LATENT', {}]
      },
      optional: {
        denoise: ['FLOAT', { default: 1.0, min: 0.0, max: 1.0, step: 0.01 }]
      }
    },
    output: ['LATENT'],
    output_is_list: [false],
    output_name: ['LATENT'],
    name: 'KSampler',
    display_name: 'KSampler',
    description: 'Samples latents using the provided model and conditioning.',
    category: 'sampling',
    output_node: false,
    python_module: 'nodes',
    deprecated: false,
    experimental: false
  },

  CheckpointLoaderSimple: {
    input: {
      required: {
        ckpt_name: [
          ['v1-5-pruned.safetensors', 'sd_xl_base_1.0.safetensors'],
          {}
        ]
      }
    },
    output: ['MODEL', 'CLIP', 'VAE'],
    output_is_list: [false, false, false],
    output_name: ['MODEL', 'CLIP', 'VAE'],
    name: 'CheckpointLoaderSimple',
    display_name: 'Load Checkpoint',
    description: 'Loads a diffusion model checkpoint.',
    category: 'loaders',
    output_node: false,
    python_module: 'nodes',
    deprecated: false,
    experimental: false
  },

  CLIPTextEncode: {
    input: {
      required: {
        text: ['STRING', { multiline: true, dynamicPrompts: true }],
        clip: ['CLIP', {}]
      }
    },
    output: ['CONDITIONING'],
    output_is_list: [false],
    output_name: ['CONDITIONING'],
    name: 'CLIPTextEncode',
    display_name: 'CLIP Text Encode (Prompt)',
    description: 'Encodes a text prompt using a CLIP model.',
    category: 'conditioning',
    output_node: false,
    python_module: 'nodes',
    deprecated: false,
    experimental: false
  },

  EmptyLatentImage: {
    input: {
      required: {
        width: ['INT', { default: 512, min: 16, max: 16384, step: 8 }],
        height: ['INT', { default: 512, min: 16, max: 16384, step: 8 }],
        batch_size: ['INT', { default: 1, min: 1, max: 4096 }]
      }
    },
    output: ['LATENT'],
    output_is_list: [false],
    output_name: ['LATENT'],
    name: 'EmptyLatentImage',
    display_name: 'Empty Latent Image',
    description: 'Creates an empty latent image of the specified dimensions.',
    category: 'latent',
    output_node: false,
    python_module: 'nodes',
    deprecated: false,
    experimental: false
  },

  VAEDecode: {
    input: {
      required: {
        samples: ['LATENT', {}],
        vae: ['VAE', {}]
      }
    },
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE'],
    name: 'VAEDecode',
    display_name: 'VAE Decode',
    description: 'Decodes latent images back into pixel space.',
    category: 'latent',
    output_node: false,
    python_module: 'nodes',
    deprecated: false,
    experimental: false
  },

  SaveImage: {
    input: {
      required: {
        images: ['IMAGE', {}],
        filename_prefix: ['STRING', { default: 'ComfyUI' }]
      }
    },
    output: [],
    output_is_list: [],
    output_name: [],
    name: 'SaveImage',
    display_name: 'Save Image',
    description: 'Saves images to the output directory.',
    category: 'image',
    output_node: true,
    python_module: 'nodes',
    deprecated: false,
    experimental: false
  }
}

export function createMockNodeDefinitions(
  overrides?: Record<string, ComfyNodeDef>
): Record<string, ComfyNodeDef> {
  return { ...baseNodeDefinitions, ...overrides }
}

export const mockNodeDefinitions = baseNodeDefinitions
