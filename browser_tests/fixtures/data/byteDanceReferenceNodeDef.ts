import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'

export const BYTEDANCE_REFERENCE_NODE_TYPE = 'ByteDance2ReferenceNode'

export const REFERENCE_IMAGES_PREFIX = 'model.reference_images.'

function ordinalNames(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}_${index + 1}`)
}

function autogrowGroup(
  templateInputName: string,
  templateInputSpec: InputSpec,
  names: string[]
): InputSpec {
  return [
    'COMFY_AUTOGROW_V3',
    {
      template: {
        input: { required: { [templateInputName]: templateInputSpec } },
        names,
        min: 0
      }
    }
  ]
}

/**
 * Trimmed copy of the `/object_info` entry the ComfyUI backend serves for the
 * Seedance reference-to-video API node: one dynamic-combo model option whose
 * reference slots are `COMFY_AUTOGROW_V3` groups. Injected into `object_info`
 * so the spec does not depend on the pinned CI backend shipping this API node.
 */
export const byteDanceReferenceNodeDef: ComfyNodeDef = {
  name: BYTEDANCE_REFERENCE_NODE_TYPE,
  display_name: 'ByteDance Seedance 2.5 Reference to Video',
  description: '',
  category: 'partner/video/ByteDance',
  python_module: 'comfy_api_nodes.nodes_bytedance',
  output_node: false,
  api_node: true,
  output: ['VIDEO'],
  output_is_list: [false],
  output_name: ['VIDEO'],
  input: {
    required: {
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'Seedance 2.5',
              inputs: {
                required: {
                  prompt: ['STRING', { default: '', multiline: true }],
                  resolution: [
                    'COMBO',
                    {
                      default: '720p',
                      multiselect: false,
                      options: ['480p', '720p']
                    }
                  ],
                  ratio: [
                    'COMBO',
                    {
                      default: '16:9',
                      multiselect: false,
                      options: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9']
                    }
                  ],
                  duration: [
                    'INT',
                    { default: 5, min: 4, max: 30, step: 1, display: 'slider' }
                  ],
                  generate_audio: ['BOOLEAN', { default: true }],
                  video_editing: ['BOOLEAN', { default: false }],
                  output_format: [
                    'COMBO',
                    { default: 'mp4', multiselect: false, options: ['mp4'] }
                  ],
                  reference_images: autogrowGroup(
                    'reference_image',
                    ['IMAGE', {}],
                    ordinalNames('image', 30)
                  ),
                  reference_videos: autogrowGroup(
                    'reference_video',
                    ['VIDEO', {}],
                    ordinalNames('video', 10)
                  ),
                  reference_audios: autogrowGroup(
                    'reference_audio',
                    ['AUDIO', {}],
                    ordinalNames('audio', 10)
                  ),
                  reference_assets: autogrowGroup(
                    'reference_asset',
                    ['STRING', { forceInput: true, multiline: false }],
                    ordinalNames('asset', 30)
                  )
                }
              }
            }
          ]
        }
      ],
      seed: [
        'INT',
        {
          default: 0,
          min: 0,
          max: 2147483647,
          step: 1,
          control_after_generate: true
        }
      ],
      watermark: ['BOOLEAN', { default: false }]
    }
  },
  input_order: { required: ['model', 'seed', 'watermark'] }
}
