import { z } from 'astro/zod'

import rawModels from '../src/data/workshop-creator-models.json'
import type { WorkshopCreatorForm } from '../src/config/workshop-creator-form'
import type { curateWorkshopInputs } from './workshop-input-presentation'
import { createCreatorFields, schemaAt } from './workshop-creator-fields'
import { wanCreatorRequest } from './workshop-creator-wan'

const object = z.record(z.string(), z.json())
const definitions = z
  .object({
    templates: z.record(z.string(), z.string()),
    models: z.record(
      z.string(),
      z.object({
        family: z.string(),
        options: object.default({})
      })
    )
  })
  .parse(rawModels)

export function creatorFormFor(
  id: string,
  curated: ReturnType<typeof curateWorkshopInputs>
): WorkshopCreatorForm | undefined {
  const model = definitions.models[id]
  if (!Object.hasOwn(definitions.models, id)) return
  const fields = createCreatorFields(id, curated)
  const {
    source,
    properties,
    rules,
    required,
    add,
    addRoot,
    url,
    file,
    prompt,
    settings
  } = fields
  let request: WorkshopCreatorForm['request']
  switch (model.family) {
    case 'dialogue':
      prompt('inputs/[]/text', 'text')
      add('voice_id', schemaAt(source, 'inputs/[]/voice_id'), {
        required: true
      })
      add('seed', schemaAt(source, 'seed'), { advanced: true })
      request = { kind: 'template', template: definitions.templates.dialogue }
      break
    case 'seedance':
      addRoot()
      prompt('content/[]/text')
      if (model.options.mode !== 'text') {
        file('first_frame', 'First frame', 1, model.options.mode === 'image')
        if (model.options.mode === 'mixed') {
          file('last_frame', 'Last frame')
          file('reference_images', 'Reference images', 4)
        }
      }
      request = {
        kind: 'callback',
        callback: 'seedance',
        options: model.options
      }
      break
    case 'seedream':
      addRoot()
      required.add('prompt')
      if (Object.hasOwn(object.parse(source.properties), 'image'))
        file('images', 'Reference images', 10)
      request = { kind: 'callback', callback: 'seedream', options: {} }
      break
    case 'gemini-image':
      prompt('contents/[]/parts/[]/text')
      file('images', 'Images', 4)
      settings(
        'generationConfig',
        ['temperature', 'topP', 'topK', 'maxOutputTokens'],
        'config_'
      )
      add(
        'image_aspectRatio',
        {
          ...schemaAt(source, 'generationConfig/imageConfig/aspectRatio'),
          enum: [
            '1:1',
            '2:3',
            '3:2',
            '3:4',
            '4:3',
            '4:5',
            '5:4',
            '9:16',
            '16:9',
            '21:9'
          ],
          default: '1:1'
        },
        { label: 'Aspect ratio', help: '', advanced: false }
      )
      if (id !== 'vertexai/gemini-2.5-flash-image')
        add(
          'image_imageSize',
          {
            ...schemaAt(source, 'generationConfig/imageConfig/imageSize'),
            enum: ['1K', '2K', '4K'],
            default: '1K'
          },
          { label: 'Resolution', help: '', advanced: false }
        )
      request = { kind: 'callback', callback: 'gemini-image', options: {} }
      break
    case 'qwen-image':
      prompt('input/messages/[]/content/[]/text')
      url('image_url', 'Reference image')
      url('image_url_2', 'Reference image 2')
      url('image_url_3', 'Reference image 3')
      settings(
        'parameters',
        ['n', 'negative_prompt', 'prompt_extend', 'seed', 'size', 'watermark'],
        'param_'
      )
      request = { kind: 'callback', callback: 'qwen-image', options: {} }
      break
    case 'bria-edit':
      addRoot(['instruction', 'structured_instruction', 'mask'])
      prompt('instruction')
      url('image_url', 'Image', true)
      url('mask_url', 'Mask image')
      request = { kind: 'callback', callback: 'bria-edit', options: {} }
      break
    case 'bria-expand':
      addRoot()
      add(
        'aspect_ratio',
        {
          type: 'string',
          enum: [
            '1:1',
            '2:3',
            '3:2',
            '3:4',
            '4:3',
            '4:5',
            '5:4',
            '9:16',
            '16:9'
          ],
          default: '1:1'
        },
        { label: 'Aspect ratio', help: '', advanced: false }
      )
      request = { kind: 'callback', callback: 'flat', options: {} }
      break
    case 'nested-settings':
      addRoot()
      settings(
        'settings',
        ['aspect_ratio', 'duration', 'resolution'],
        'setting_'
      )
      request = { kind: 'callback', callback: 'nested-settings', options: {} }
      break
    case 'runway-image':
      addRoot()
      if (model.options.mode === 'first-frame')
        file('images', 'First frame', 1, true)
      else file('images', 'Reference images', 3)
      request = {
        kind: 'callback',
        callback: 'runway-image',
        options: model.options
      }
      break
    case 'tencent-file': {
      addRoot()
      const field = model.options.field === 'File3D' ? 'File3D' : 'File'
      add('file_type', schemaAt(source, `${field}/Type`), {
        label: 'File type',
        help: '',
        required: true,
        advanced: false
      })
      url('file_url', '3D file', true, 'file')
      if (id === 'tencent/hunyuan-3d-texture-edit') {
        file('image', 'Reference texture', 1, false, [
          'image/jpeg',
          'image/png'
        ])
        rules.image = {
          help: 'Uses this image instead of the text prompt; turn PBR off.'
        }
      }
      request = {
        kind: 'callback',
        callback: 'tencent-file',
        options: {
          ...model.options,
          texture: id === 'tencent/hunyuan-3d-texture-edit'
        }
      }
      break
    }
    case 'meshy-source':
      addRoot(['model_url', 'input_task_id'])
      url('model_url', '3D model', false, 'file')
      add('input_task_id', schemaAt(source, 'input_task_id'), {
        label: 'Existing task ID',
        help: 'Use a completed task instead of a model URL.',
        advanced: true
      })
      if (id === 'meshy/remesh')
        add('target_format', schemaAt(source, 'target_formats/[]'), {
          label: 'Output format',
          help: '',
          default: 'glb',
          advanced: true
        })
      request = { kind: 'callback', callback: 'meshy-source', options: {} }
      break
    case 'kling-avatar':
      addRoot(['image', 'audio_id', 'sound_file'])
      url('image_url', 'Portrait image', true)
      url('audio_url', 'Audio', true, 'audio')
      request = { kind: 'callback', callback: 'kling-avatar', options: {} }
      break
    case 'kling-lip-sync':
      url('video_url', 'Video', true, 'video')
      url('audio_url', 'Audio', true, 'audio')
      request = { kind: 'callback', callback: 'kling-lip-sync', options: {} }
      break
    case 'veo':
      prompt('instances/[]/prompt')
      file('first_frame', 'First frame', 1, false, ['image/jpeg', 'image/png'])
      file('last_frame', 'Last frame', 1, false, ['image/jpeg', 'image/png'])
      file('reference_images', 'Reference images', 3, false, [
        'image/jpeg',
        'image/png'
      ])
      settings(
        'parameters',
        [
          'aspectRatio',
          'durationSeconds',
          'generateAudio',
          'negativePrompt',
          'resolution',
          'sampleCount',
          'seed'
        ],
        'param_'
      )
      Object.assign(properties, {
        param_aspectRatio: {
          ...object.parse(properties.param_aspectRatio),
          default: '16:9'
        },
        param_durationSeconds: {
          ...object.parse(properties.param_durationSeconds),
          enum: [4, 6, 8],
          default: 8
        },
        param_resolution: {
          ...object.parse(properties.param_resolution),
          default: '720p'
        },
        param_sampleCount: {
          ...object.parse(properties.param_sampleCount),
          minimum: 1,
          maximum: 4,
          default: 1
        }
      })
      rules.param_aspectRatio = {
        label: 'Aspect ratio',
        help: '',
        advanced: false
      }
      rules.param_durationSeconds = {
        label: 'Duration',
        help: '',
        unit: 'seconds',
        advanced: false
      }
      rules.param_sampleCount = {
        label: 'Number of videos',
        help: '',
        advanced: false
      }
      request = { kind: 'callback', callback: 'veo', options: {} }
      break
    case 'bfl-video':
      addRoot()
      required.add('prompt')
      url('start_video', 'Source video', false, 'video')
      file('images', 'Keyframe images', 10)
      rules.images = {
        help: 'Choose image-to-video mode. More than two images needs a fixed duration.'
      }
      request = { kind: 'callback', callback: 'bfl-video', options: {} }
      break
    case 'grok-video':
      addRoot()
      url('image_url', 'First frame image')
      request = { kind: 'callback', callback: 'grok-video', options: {} }
      break
    case 'flat':
      addRoot(['multi_shot', 'shot_type', 'type'])
      if (Object.hasOwn(properties, 'prompt')) required.add('prompt')
      if (id === 'ideogram/ideogram-v4') required.add('text_prompt')
      if (id === 'kling/kling-v1-5') required.add('image')
      request = { kind: 'callback', callback: 'flat', options: {} }
      break
    case 'wan-media':
      request = wanCreatorRequest(id, model.options, fields)
      break
    default:
      throw new Error(`Unknown creator form family: ${model.family}`)
  }
  return fields.build(request)
}
