import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const minimaxNodeDef: ComfyNodeDef = {
  name: 'MiniMaxH3ReferenceToVideo',
  display_name: 'MiniMax H3 Reference to Video',
  category: 'model/conditioning/minimax',
  description:
    '<Picture i> / <Video k> / <Audio j> reference conditioning for MiniMax H3. Use the same tags when prompting.',
  python_module: 'comfy_extras.nodes_minimax_h3',
  output_node: false,
  input: {
    required: {
      clip: ['CLIP', {}],
      vae: ['VAE', {}],
      audio_vae: ['VAE', {}],
      prompt: [
        'STRING',
        {
          multiline: true,
          dynamicPrompts: true
        }
      ],
      width: [
        'INT',
        {
          default: 1344,
          min: 32,
          max: 16384,
          step: 32
        }
      ],
      height: [
        'INT',
        {
          default: 768,
          min: 32,
          max: 16384,
          step: 32
        }
      ],
      length: [
        'INT',
        {
          tooltip:
            'Frame count at 24 fps, (124 = ~5s, trained range is ~124-362)',
          default: 124,
          min: 5,
          max: 3600,
          step: 17
        }
      ],
      ref_image_size: [
        'COMBO',
        {
          tooltip:
            "Reference image sizing. 'match' scales each ref (down only, keeping aspect) to the generation's pixel area; 'max' uses the reference pipeline's 2048px short edge for best identity fidelity. Reference tokens ride through every sampling step, so 'max' can be several times slower.",
          default: 'match',
          multiselect: false,
          options: ['match', 'max']
        }
      ]
    },
    optional: {
      ref_images: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: {
              required: {
                ref_image: [
                  'IMAGE',
                  {
                    tooltip:
                      'Reference image (downscaled to 2048 short edge if larger, never upscaled)'
                  }
                ]
              }
            },
            prefix: 'ref_image_',
            min: 0,
            max: 9
          }
        }
      ],
      ref_videos: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: {
              required: {
                ref_video: [
                  'IMAGE',
                  {
                    tooltip: 'Reference video frames at 24 fps (2-15s)'
                  }
                ]
              }
            },
            prefix: 'ref_video_',
            min: 0,
            max: 3
          }
        }
      ],
      ref_video_audios: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: {
              required: {
                ref_video_audio: [
                  'AUDIO',
                  {
                    tooltip: 'Soundtrack of the same-numbered reference video'
                  }
                ]
              }
            },
            prefix: 'ref_video_audio_',
            min: 0,
            max: 3
          }
        }
      ],
      ref_audios: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: {
              required: {
                ref_audio: [
                  'AUDIO',
                  {
                    tooltip: 'Standalone reference audio'
                  }
                ]
              }
            },
            prefix: 'ref_audio_',
            min: 0,
            max: 3
          }
        }
      ]
    }
  },
  input_order: {
    required: [
      'clip',
      'vae',
      'audio_vae',
      'prompt',
      'width',
      'height',
      'length',
      'ref_image_size'
    ],
    optional: ['ref_images', 'ref_videos', 'ref_video_audios', 'ref_audios']
  },
  output: ['CONDITIONING', 'LATENT'],
  output_name: ['positive', 'LATENT']
}

export const minimaxNode = {
  id: 136,
  type: 'MiniMaxH3ReferenceToVideo',
  pos: [-620, 5420],
  size: [400, 380],
  flags: {},
  order: 21,
  mode: 0,
  inputs: [
    {
      name: 'clip',
      type: 'CLIP',
      link: null
    },
    {
      name: 'vae',
      type: 'VAE',
      link: null
    },
    {
      name: 'audio_vae',
      type: 'VAE',
      link: null
    },
    {
      label: 'ref_image_0',
      name: 'ref_images.ref_image_0',
      shape: 7,
      type: 'IMAGE',
      link: 278
    },
    {
      label: 'ref_image_1',
      name: 'ref_images.ref_image_1',
      shape: 7,
      type: 'IMAGE',
      link: 282
    },
    {
      label: 'ref_image_2',
      name: 'ref_images.ref_image_2',
      shape: 7,
      type: 'IMAGE',
      link: null
    },
    {
      label: 'ref_video_0',
      name: 'ref_videos.ref_video_0',
      shape: 7,
      type: 'IMAGE',
      link: null
    },
    {
      label: 'ref_video_audio_0',
      name: 'ref_video_audios.ref_video_audio_0',
      shape: 7,
      type: 'AUDIO',
      link: null
    },
    {
      label: 'ref_audio_0',
      name: 'ref_audios.ref_audio_0',
      shape: 7,
      type: 'AUDIO',
      link: null
    },
    {
      name: 'prompt',
      type: 'STRING',
      widget: {
        name: 'prompt'
      },
      link: 279
    },
    {
      name: 'width',
      type: 'INT',
      widget: {
        name: 'width'
      },
      link: 276
    },
    {
      name: 'height',
      type: 'INT',
      widget: {
        name: 'height'
      },
      link: 277
    },
    {
      name: 'length',
      type: 'INT',
      widget: {
        name: 'length'
      },
      link: 275
    }
  ],
  outputs: [
    {
      name: 'positive',
      type: 'CONDITIONING',
      links: []
    },
    {
      name: 'LATENT',
      type: 'LATENT',
      links: []
    }
  ],
  widgets_values: ['', 1344, 768, 124, 'match']
} satisfies ISerialisedNode
