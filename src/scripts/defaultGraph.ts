import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const testDefaultGraph: ComfyWorkflowJSON = {
  last_node_id: 9,
  last_link_id: 9,
  nodes: [
    {
      id: 7,
      type: 'CLIPTextEncode',
      pos: [413, 389],
      size: [425.27801513671875, 180.6060791015625],
      flags: {},
      order: 3,
      mode: 0,
      inputs: [{ name: 'clip', type: 'CLIP', link: 5 }],
      outputs: [
        {
          name: 'CONDITIONING',
          type: 'CONDITIONING',
          links: [6],
          slot_index: 0
        }
      ],
      properties: {},
      widgets_values: ['text, watermark']
    },
    {
      id: 6,
      type: 'CLIPTextEncode',
      pos: [415, 186],
      size: [422.84503173828125, 164.31304931640625],
      flags: {},
      order: 2,
      mode: 0,
      inputs: [{ name: 'clip', type: 'CLIP', link: 3 }],
      outputs: [
        {
          name: 'CONDITIONING',
          type: 'CONDITIONING',
          links: [4],
          slot_index: 0
        }
      ],
      properties: {},
      widgets_values: [
        'beautiful scenery nature glass bottle landscape, , purple galaxy bottle,'
      ]
    },
    {
      id: 5,
      type: 'EmptyLatentImage',
      pos: [473, 609],
      size: [315, 106],
      flags: {},
      order: 1,
      mode: 0,
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [2], slot_index: 0 }],
      properties: {},
      widgets_values: [512, 512, 1]
    },
    {
      id: 3,
      type: 'KSampler',
      pos: [863, 186],
      size: [315, 262],
      flags: {},
      order: 4,
      mode: 0,
      inputs: [
        { name: 'model', type: 'MODEL', link: 1 },
        { name: 'positive', type: 'CONDITIONING', link: 4 },
        { name: 'negative', type: 'CONDITIONING', link: 6 },
        { name: 'latent_image', type: 'LATENT', link: 2 }
      ],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [7], slot_index: 0 }],
      properties: {},
      widgets_values: [156680208700286, true, 20, 8, 'euler', 'normal', 1]
    },
    {
      id: 8,
      type: 'VAEDecode',
      pos: [1209, 188],
      size: [210, 46],
      flags: {},
      order: 5,
      mode: 0,
      inputs: [
        { name: 'samples', type: 'LATENT', link: 7 },
        { name: 'vae', type: 'VAE', link: 8 }
      ],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [9], slot_index: 0 }],
      properties: {}
    },
    {
      id: 9,
      type: 'SaveImage',
      pos: [1451, 189],
      size: [210, 26],
      flags: {},
      order: 6,
      mode: 0,
      inputs: [{ name: 'images', type: 'IMAGE', link: 9 }],
      properties: {}
    },
    {
      id: 4,
      type: 'CheckpointLoaderSimple',
      pos: [26, 474],
      size: [315, 98],
      flags: {},
      order: 0,
      mode: 0,
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [1], slot_index: 0 },
        { name: 'CLIP', type: 'CLIP', links: [3, 5], slot_index: 1 },
        { name: 'VAE', type: 'VAE', links: [8], slot_index: 2 }
      ],
      properties: {
        models: [
          {
            name: 'v1-5-pruned-emaonly-fp16.safetensors',
            url: 'https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive/resolve/main/v1-5-pruned-emaonly-fp16.safetensors',
            directory: 'checkpoints'
          }
        ]
      },
      widgets_values: ['v1-5-pruned-emaonly-fp16.safetensors']
    }
  ],
  links: [
    [1, 4, 0, 3, 0, 'MODEL'],
    [2, 5, 0, 3, 3, 'LATENT'],
    [3, 4, 1, 6, 0, 'CLIP'],
    [4, 6, 0, 3, 1, 'CONDITIONING'],
    [5, 4, 1, 7, 0, 'CLIP'],
    [6, 7, 0, 3, 2, 'CONDITIONING'],
    [7, 3, 0, 8, 0, 'LATENT'],
    [8, 4, 2, 8, 1, 'VAE'],
    [9, 8, 0, 9, 0, 'IMAGE']
  ],
  groups: [],
  config: {},
  extra: {
    ds: {
      offset: [0, 0],
      scale: 1
    }
  },
  version: 0.4
}

const prodDefaultGraph: ComfyWorkflowJSON = {
  last_node_id: 71,
  last_link_id: 82,
  nodes: [
    {
      id: 9,
      type: 'SaveImage',
      pos: [1279.9999726783708, 319.9999392082668],
      size: [300, 420],
      flags: {},
      order: 9,
      mode: 0,
      inputs: [
        {
          name: 'images',
          type: 'IMAGE',
          link: 80
        }
      ],
      outputs: [],
      properties: {
        'Node name for S&R': 'SaveImage',
        cnr_id: 'comfy-core',
        ver: '0.3.64',
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: ['ComfyUI']
    },
    {
      id: 62,
      type: 'CLIPLoader',
      pos: [-239.9999987113997, 420.0000536491848],
      size: [340, 169.3125],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        {
          name: 'CLIP',
          type: 'CLIP',
          links: [79, 81]
        }
      ],
      properties: {
        'Node name for S&R': 'CLIPLoader',
        cnr_id: 'comfy-core',
        ver: '0.3.73',
        models: [
          {
            name: 'qwen_3_4b.safetensors',
            url: 'https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors',
            directory: 'text_encoders'
          }
        ],
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: ['qwen_3_4b.safetensors', 'lumina2', 'default']
    },
    {
      id: 63,
      type: 'VAELoader',
      pos: [659.9998200904802, 699.9998629143215],
      size: [320, 106.65625],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [],
      outputs: [
        {
          name: 'VAE',
          type: 'VAE',
          links: [74]
        }
      ],
      properties: {
        'Node name for S&R': 'VAELoader',
        cnr_id: 'comfy-core',
        ver: '0.3.73',
        models: [
          {
            name: 'ae.safetensors',
            url: 'https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors',
            directory: 'vae'
          }
        ],
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: ['ae.safetensors']
    },
    {
      id: 65,
      type: 'VAEDecode',
      pos: [1019.9998200904802, 319.9999392082668],
      size: [225, 96],
      flags: {},
      order: 8,
      mode: 0,
      inputs: [
        {
          name: 'samples',
          type: 'LATENT',
          link: 73
        },
        {
          name: 'vae',
          type: 'VAE',
          link: 74
        }
      ],
      outputs: [
        {
          name: 'IMAGE',
          type: 'IMAGE',
          slot_index: 0,
          links: [80]
        }
      ],
      properties: {
        'Node name for S&R': 'VAEDecode',
        cnr_id: 'comfy-core',
        ver: '0.3.64',
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: []
    },
    {
      id: 66,
      type: 'UNETLoader',
      pos: [-239.9999987113997, 110.00000596546897],
      size: [380, 134.65625],
      flags: {},
      order: 2,
      mode: 0,
      inputs: [],
      outputs: [
        {
          name: 'MODEL',
          type: 'MODEL',
          links: [72]
        }
      ],
      properties: {
        'Node name for S&R': 'UNETLoader',
        cnr_id: 'comfy-core',
        ver: '0.3.73',
        models: [
          {
            name: 'z_image_turbo_bf16.safetensors',
            url: 'https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/diffusion_models/z_image_turbo_bf16.safetensors',
            directory: 'diffusion_models'
          }
        ],
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: ['z_image_turbo_bf16.safetensors', 'default']
    },
    {
      id: 67,
      type: 'CLIPTextEncode',
      pos: [170.00001082534345, 290.0000536491848],
      size: [410, 160],
      flags: {},
      order: 4,
      mode: 0,
      inputs: [
        {
          name: 'clip',
          type: 'CLIP',
          link: 79
        }
      ],
      outputs: [
        {
          name: 'CONDITIONING',
          type: 'CONDITIONING',
          links: [76]
        }
      ],
      properties: {
        'Node name for S&R': 'CLIPTextEncode',
        cnr_id: 'comfy-core',
        ver: '0.3.73',
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: [
        'anime RPG game style, cute anime girl with gigantic fennec ears and a big fluffy fox tail with long wavy blonde hair and large blue eyes blonde colored eyelashes wearing a pink sweater a large oversized gold trimmed black winter coat and a long blue maxi skirt and a red scarf, she is sitting beside a campfire in the wilderness at night playing guitar with a milky way galaxy sky'
      ]
    },
    {
      id: 68,
      type: 'EmptySD3LatentImage',
      pos: [310.0000489723161, 700.0000155022121],
      size: [260, 168],
      flags: {},
      order: 3,
      mode: 0,
      inputs: [],
      outputs: [
        {
          name: 'LATENT',
          type: 'LATENT',
          slot_index: 0,
          links: [78]
        }
      ],
      properties: {
        'Node name for S&R': 'EmptySD3LatentImage',
        cnr_id: 'comfy-core',
        ver: '0.3.64',
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: [1024, 1024, 1]
    },
    {
      id: 69,
      type: 'ModelSamplingAuraFlow',
      pos: [220.00001082534345, 110.00000596546897],
      size: [310, 104],
      flags: {},
      order: 6,
      mode: 0,
      inputs: [
        {
          name: 'model',
          type: 'MODEL',
          link: 72
        }
      ],
      outputs: [
        {
          name: 'MODEL',
          type: 'MODEL',
          slot_index: 0,
          links: [75]
        }
      ],
      properties: {
        'Node name for S&R': 'ModelSamplingAuraFlow',
        cnr_id: 'comfy-core',
        ver: '0.3.64',
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: [3]
    },
    {
      id: 70,
      type: 'KSampler',
      pos: [659.9998200904802, 319.9999392082668],
      size: [315, 341.3125],
      flags: {},
      order: 7,
      mode: 0,
      inputs: [
        {
          name: 'model',
          type: 'MODEL',
          link: 75
        },
        {
          name: 'positive',
          type: 'CONDITIONING',
          link: 76
        },
        {
          name: 'negative',
          type: 'CONDITIONING',
          link: 82
        },
        {
          name: 'latent_image',
          type: 'LATENT',
          link: 78
        }
      ],
      outputs: [
        {
          name: 'LATENT',
          type: 'LATENT',
          slot_index: 0,
          links: [73]
        }
      ],
      properties: {
        'Node name for S&R': 'KSampler',
        cnr_id: 'comfy-core',
        ver: '0.3.64',
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: [42, 'fixed', 8, 1, 'res_multistep', 'simple', 1]
    },
    {
      id: 71,
      type: 'CLIPTextEncode',
      pos: [170.00001082534345, 520.0000536491848],
      size: [405.46875, 140],
      flags: {},
      order: 5,
      mode: 0,
      inputs: [
        {
          name: 'clip',
          type: 'CLIP',
          link: 81
        }
      ],
      outputs: [
        {
          name: 'CONDITIONING',
          type: 'CONDITIONING',
          links: [82]
        }
      ],
      properties: {
        'Node name for S&R': 'CLIPTextEncode',
        cnr_id: 'comfy-core',
        ver: '0.3.73',
        enableTabs: false,
        tabWidth: 65,
        tabXOffset: 10,
        hasSecondTab: false,
        secondTabText: 'Send Back',
        secondTabOffset: 80,
        secondTabWidth: 65
      },
      widgets_values: [
        'low quality, bad anatomy, extra digits, missing digits, extra limbs, missing limbs'
      ]
    }
  ],
  links: [
    [72, 66, 0, 69, 0, 'MODEL'],
    [73, 70, 0, 65, 0, 'LATENT'],
    [74, 63, 0, 65, 1, 'VAE'],
    [75, 69, 0, 70, 0, 'MODEL'],
    [76, 67, 0, 70, 1, 'CONDITIONING'],
    [78, 68, 0, 70, 3, 'LATENT'],
    [79, 62, 0, 67, 0, 'CLIP'],
    [80, 65, 0, 9, 0, 'IMAGE'],
    [81, 62, 0, 71, 0, 'CLIP'],
    [82, 71, 0, 70, 2, 'CONDITIONING']
  ],
  groups: [],
  config: {},
  extra: {
    ds: {
      scale: 0.9,
      offset: [416, 110]
    }
  },
  version: 0.4
}

export const defaultGraph: ComfyWorkflowJSON =
  import.meta.env.VITE_USE_LEGACY_DEFAULT_GRAPH === 'true'
    ? testDefaultGraph
    : prodDefaultGraph

export const defaultGraphJSON = JSON.stringify(defaultGraph)

export const blankGraph: ComfyWorkflowJSON = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}
