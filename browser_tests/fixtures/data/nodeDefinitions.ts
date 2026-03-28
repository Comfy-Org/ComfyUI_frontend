import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const mockNodeDefinitions: Record<string, ComfyNodeDef> = {
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
  }
}
