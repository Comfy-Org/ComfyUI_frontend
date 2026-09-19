import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

type RequiredInputs = NonNullable<
  NonNullable<ComfyNodeDef['input']>['required']
>

/** Stable core-node subset for recorded agent replay on variable cloud catalogs. */
export const agentReplayNodeDefs: Record<string, ComfyNodeDef> = {
  CheckpointLoaderSimple: node(
    'CheckpointLoaderSimple',
    'Load Checkpoint',
    { ckpt_name: combo([]) },
    ['MODEL', 'CLIP', 'VAE']
  ),
  CLIPTextEncode: node(
    'CLIPTextEncode',
    'CLIP Text Encode (Prompt)',
    {
      text: ['STRING', { default: '', multiline: true, dynamicPrompts: true }],
      clip: ['CLIP', {}]
    },
    ['CONDITIONING']
  ),
  EmptyLatentImage: node(
    'EmptyLatentImage',
    'Empty Latent Image',
    {
      width: ['INT', { default: 512, min: 16, max: 16384, step: 8 }],
      height: ['INT', { default: 512, min: 16, max: 16384, step: 8 }],
      batch_size: ['INT', { default: 1, min: 1, max: 4096 }]
    },
    ['LATENT']
  ),
  KSampler: node(
    'KSampler',
    'KSampler',
    {
      model: ['MODEL', {}],
      seed: [
        'INT',
        {
          default: 0,
          min: 0,
          max: Number.MAX_SAFE_INTEGER,
          control_after_generate: true
        }
      ],
      steps: ['INT', { default: 20, min: 1, max: 10_000 }],
      cfg: ['FLOAT', { default: 8, min: 0, max: 100, step: 0.1 }],
      sampler_name: combo(['euler']),
      scheduler: combo(['normal']),
      positive: ['CONDITIONING', {}],
      negative: ['CONDITIONING', {}],
      latent_image: ['LATENT', {}],
      denoise: ['FLOAT', { default: 1, min: 0, max: 1, step: 0.01 }]
    },
    ['LATENT']
  ),
  PrimitiveStringMultiline: node(
    'PrimitiveStringMultiline',
    'Primitive String (Multiline)',
    { value: ['STRING', { default: '', multiline: true }] },
    ['STRING']
  ),
  SaveImage: {
    ...node(
      'SaveImage',
      'Save Image',
      {
        images: ['IMAGE', {}],
        filename_prefix: ['STRING', { default: 'ComfyUI' }]
      },
      []
    ),
    output_node: true
  },
  VAEDecode: node(
    'VAEDecode',
    'VAE Decode',
    { samples: ['LATENT', {}], vae: ['VAE', {}] },
    ['IMAGE']
  )
}

function combo(options: string[]): RequiredInputs[string] {
  return [options, {}]
}

function node(
  name: string,
  displayName: string,
  required: RequiredInputs,
  output: string[]
): ComfyNodeDef {
  return {
    name,
    display_name: displayName,
    description: '',
    category: 'agent replay',
    python_module: 'browser_tests.agent_replay',
    output_node: false,
    input: { required },
    output,
    output_name: output,
    output_is_list: output.map(() => false)
  }
}
