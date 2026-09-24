import { z } from 'astro/zod'

import rawModels from '../src/data/workshop-creator-models.json'
import type { WorkshopCreatorForm } from '../src/config/workshop-creator-form'
import type { curateWorkshopInputs } from './workshop-input-presentation'
import { createCreatorFields, schemaAt } from './workshop-creator-fields'
import { wanCreatorRequest } from './workshop-creator-wan'
import { workshopContentInputs } from '../src/config/workshop-content-inputs'
import { workshopCreatorDefinitionSchema } from './workshop-creator-definition'

const object = z.record(z.string(), z.json())
const definitions = z
  .object({
    models: z.record(z.string(), workshopCreatorDefinitionSchema)
  })
  .parse(rawModels)

function restrictReferenceVideoResolution(
  properties: z.infer<typeof object>
): void {
  properties.resolution = {
    ...object.parse(properties.resolution),
    enum: ['480p', '720p'],
    default: '720p'
  }
}

export function creatorFormFor(
  id: string,
  curated: ReturnType<typeof curateWorkshopInputs>,
  options: z.infer<typeof object> = {}
): WorkshopCreatorForm | undefined {
  if (!Object.hasOwn(definitions.models, id)) return
  const definition = definitions.models[id]
  const model = workshopCreatorDefinitionSchema.parse({
    ...definition,
    options: { ...definition.options, ...options }
  })
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
    case 'gemini-video':
      add(
        'input',
        { type: 'string' },
        {
          label: 'Prompt',
          help: '',
          advanced: false,
          control: 'text-area',
          required: true
        }
      )
      if (model.options.mode === 'image_to_video') {
        url('image_url', 'First frame', true)
        url('last_frame_url', 'Last frame')
      }
      if (model.options.mode === 'edit')
        file(
          'video',
          'Source video',
          1,
          true,
          ['video/mp4', 'video/webm'],
          'video'
        )
      request = {
        kind: 'callback',
        callback: 'gemini-video',
        options: model.options
      }
      break
    case 'luma-image':
      addRoot(['generation_type', 'type'])
      prompt('prompt')
      url(
        'image_url',
        model.options.mode === 'edit' ? 'Source image' : 'Reference image',
        model.options.mode === 'edit'
      )
      request = {
        kind: 'callback',
        callback: 'luma-image',
        options: model.options
      }
      break
    case 'luma-video':
      addRoot()
      url('first_frame_url', 'First frame', model.options.mode === 'image')
      url('last_frame_url', 'Last frame')
      request = { kind: 'callback', callback: 'luma-video', options: {} }
      break
    case 'text-input':
      addRoot(['input'])
      // Use the supported text variant; the complete native schema still validates the body.
      add(
        'input',
        { type: 'string' },
        {
          label: 'Prompt',
          help: '',
          advanced: false,
          control: 'text-area',
          required: true
        }
      )
      request = { kind: 'callback', callback: 'flat', options: {} }
      break
    case 'dialogue':
      add(
        'inputs',
        {
          ...schemaAt(source, 'inputs'),
          items: schemaAt(source, 'inputs/[]'),
          default: object.parse(source.example).inputs
        },
        {
          label: 'Dialogue',
          help: 'Add speaking turns in order, using up to ten distinct voice IDs.',
          control: 'dialogue',
          advanced: false,
          required: true
        }
      )
      add('seed', schemaAt(source, 'seed'), { advanced: true })
      request = { kind: 'callback', callback: 'dialogue', options: {} }
      break
    case 'seedance':
      // An edit keeps the source clip's length and aspect ratio, so those
      // controls (and the last-frame return) are not offered on the edit page.
      addRoot(
        model.options.mode === 'edit'
          ? ['duration', 'ratio', 'return_last_frame']
          : []
      )
      prompt('content/[]/text')
      if (model.options.urlMedia) {
        if (model.options.mode === 'reference') {
          url('reference_image_url', 'Reference image', true)
          for (let index = 2; index <= 4; index++)
            url(`reference_image_url_${index}`, `Reference image ${index}`)
        } else if (model.options.mode === 'edit') {
          // The edit page rewrites a source clip; Seedance keeps its length
          // and aspect ratio, so no frame or reference slots are offered.
          url('video_url', 'Source video', true, 'video')
        } else if (model.options.mode !== 'text') {
          url('first_frame_url', 'First frame', true)
          if (model.options.mode === 'first-last')
            url('last_frame_url', 'Last frame')
        }
      } else if (!['text', 'edit'].includes(model.options.mode)) {
        file('first_frame', 'First frame', 1, model.options.mode === 'image')
        if (model.options.mode === 'mixed') {
          file('last_frame', 'Last frame')
          file('reference_images', 'Reference images', 4)
        }
      }
      if (
        id === 'byteplus/dreamina-seedance-2-5-260628' &&
        !['text', 'edit'].includes(model.options.mode)
      ) {
        const imageFields = model.options.urlMedia
          ? model.options.mode === 'reference'
            ? [
                'reference_image_url',
                'reference_image_url_2',
                'reference_image_url_3',
                'reference_image_url_4'
              ]
            : ['first_frame_url', 'last_frame_url']
          : ['first_frame', 'last_frame', 'reference_images']
        for (const name of imageFields)
          rules[name] = {
            ...rules[name],
            imageAspectRatio: { minimum: 0.39, maximum: 2.5 },
            help: 'Use an image with an aspect ratio between 0.39 and 2.50.'
          }
      }
      request = {
        kind: 'callback',
        callback: 'seedance',
        options: model.options
      }
      break
    case 'seedream':
      addRoot(model.options.mode === 'generate' ? ['layer_decomposition'] : [])
      required.add('prompt')
      // The generate page hides the image slot; the edit page requires it.
      if (
        model.options.mode !== 'generate' &&
        Object.hasOwn(object.parse(source.properties), 'image')
      )
        file(
          'images',
          model.options.mode === 'edit' ? 'Source images' : 'Reference images',
          10,
          model.options.mode === 'edit'
        )
      if (
        id === 'byteplus/seedream-5-0-pro-260628' &&
        model.options.mode !== 'generate'
      )
        rules.images = {
          help: 'Use exactly one image when Separate layers is enabled.',
          formConstraint: {
            schema: {
              if: {
                properties: { layer_decomposition: { const: true } },
                required: ['layer_decomposition']
              },
              then: {
                required: ['images'],
                properties: {
                  images: {
                    anyOf: [
                      { type: 'object' },
                      { type: 'array', minItems: 1, maxItems: 1 }
                    ]
                  }
                }
              }
            },
            error: 'incompatible'
          }
        }
      request = { kind: 'callback', callback: 'seedream', options: {} }
      break
    case 'gemini-image':
      prompt('contents/[]/parts/[]/text')
      // The generate page hides the image slot; the edit page requires it.
      if (model.options.mode !== 'generate')
        file(
          'images',
          model.options.mode === 'edit' ? 'Source images' : 'Images',
          4,
          model.options.mode === 'edit'
        )
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
        'param_',
        {
          size: {
            options: ['1024*1024', '1536*1024', '1024*1536', '2048*2048'],
            default: '1024*1024'
          }
        }
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
    case 'veo': {
      const params = object.parse(schemaAt(source, 'parameters').properties)
      for (const name of [
        'sampleCount',
        'resolution',
        'aspectRatio',
        'durationSeconds'
      ]) {
        if (!Object.hasOwn(params, name))
          throw new Error(`Missing creator parameter ${id}:parameters.${name}`)
      }
      prompt('instances/[]/prompt')
      // Text mode (the generate page) takes no frames; image mode (the animate
      // page) requires the first frame. Without a mode every slot is optional.
      if (model.options.mode !== 'text') {
        file('first_frame', 'First frame', 1, model.options.mode === 'image', [
          'image/jpeg',
          'image/png'
        ])
        file('last_frame', 'Last frame', 1, false, ['image/jpeg', 'image/png'])
        if (model.options.mode !== 'image')
          file('reference_images', 'Reference images', 3, false, [
            'image/jpeg',
            'image/png'
          ])
        rules.first_frame = {
          help: 'A first frame is required when a last frame is provided.',
          formConstraint: {
            schema: {
              if: { required: ['last_frame'] },
              then: { required: ['first_frame'] }
            },
            error: 'required'
          }
        }
        if (model.options.mode !== 'image')
          rules.reference_images = {
            help: 'Use reference images without first or last frames.',
            formConstraint: {
              schema: {
                not: {
                  required: ['reference_images'],
                  anyOf: [
                    { required: ['first_frame'] },
                    { required: ['last_frame'] }
                  ]
                }
              },
              error: 'incompatible'
            }
          }
      }
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
        fixed: 1
      }
      request = { kind: 'callback', callback: 'veo', options: {} }
      break
    }
    case 'bfl-video':
      addRoot()
      required.add('prompt')
      if (model.options.mode)
        rules.mode = { fixed: z.string().parse(model.options.mode) }
      if (!model.options.mode || model.options.mode === 'v2v')
        url(
          'start_video',
          'Source video',
          model.options.mode === 'v2v',
          'video'
        )
      if (!model.options.mode || model.options.mode === 'i2v')
        file('images', 'Keyframe images', 10, model.options.mode === 'i2v')
      rules.images = {
        help: 'Choose image-to-video mode. More than two images needs a fixed duration.'
      }
      request = { kind: 'callback', callback: 'bfl-video', options: {} }
      break
    case 'grok-video':
      addRoot()
      if (model.options.mode === 'reference') {
        if (id === 'xai/grok-imagine-video')
          properties.duration = {
            ...object.parse(properties.duration),
            maximum: 10,
            enum: Array.from({ length: 10 }, (_, index) => index + 1)
          }
        restrictReferenceVideoResolution(properties)
        url('reference_image_url', 'Reference image', true)
        for (let index = 2; index <= 4; index++)
          url(`reference_image_url_${index}`, `Reference image ${index}`)
      } else if (model.options.mode !== 'text')
        url('image_url', 'First frame image', model.options.mode === 'image')
      request = {
        kind: 'callback',
        callback: 'grok-video',
        options: model.options
      }
      break
    case 'kling-omni-video': {
      const mode = model.options.mode
      addRoot([
        'image_list',
        'mode',
        'multi_shot',
        'shot_type',
        'sound',
        'video_list',
        ...(mode === 'edit' ? ['aspect_ratio', 'duration'] : []),
        ...(mode === 'first-last' ? ['aspect_ratio'] : []),
        ...(mode === 'reference-video' ? ['duration'] : [])
      ])
      required.add('prompt')
      if (mode === 'reference-video')
        add(
          'duration',
          {
            ...schemaAt(source, 'duration'),
            enum: ['3', '4', '5', '6', '7', '8', '9', '10'],
            default: '3'
          },
          { label: 'Duration', help: '', advanced: false }
        )
      add(
        'resolution',
        { type: 'string', enum: ['720p', '1080p'], default: '1080p' },
        { label: 'Resolution', help: '', advanced: false }
      )
      if (
        id === 'kling/kling-v3-omni' &&
        ['text', 'image', 'first-last'].includes(mode)
      )
        add(
          'generate_audio',
          { type: 'boolean', default: false },
          { label: 'Generate audio', help: '', advanced: false }
        )
      if (mode === 'first-last') {
        url('first_frame_url', 'First frame', true)
        url('last_frame_url', 'Last frame')
      }
      const referenceCount =
        mode === 'image' ? 7 : mode === 'first-last' ? 6 : 4
      if (mode !== 'text')
        for (let index = 1; index <= referenceCount; index++)
          url(
            index === 1
              ? 'reference_image_url'
              : `reference_image_url_${index}`,
            index === 1 ? 'Reference image' : `Reference image ${index}`,
            mode === 'image' && index === 1
          )
      if (mode === 'edit' || mode === 'reference-video') {
        url('video_url', 'Source video', true, 'video')
        if (id === 'kling/kling-v3-omni')
          rules.video_url = {
            ...rules.video_url,
            maxVideoDurationSeconds: 15.5,
            videoWidthPixels: { minimum: 700, maximum: 4553 },
            help: 'Use an SDR source video no longer than 15.5 seconds and between 700 and 4553 pixels wide. HDR video is not supported.'
          }
        add(
          'keep_original_sound',
          { type: 'boolean', default: true },
          { label: 'Keep original sound', help: '', advanced: false }
        )
      }
      request = {
        kind: 'callback',
        callback: 'kling-omni-video',
        options: model.options
      }
      break
    }
    case 'flat':
      addRoot(['multi_shot', 'shot_type', 'type'])
      if (Object.hasOwn(properties, 'prompt')) required.add('prompt')
      if (id === 'kling/kling-v1-5') required.add('image')
      request = { kind: 'callback', callback: 'flat', options: {} }
      break
    case 'gpt-image':
      addRoot()
      required.add('prompt')
      request = { kind: 'callback', callback: 'gpt-image', options: {} }
      break
    case 'ideogram':
      addRoot(['text_prompt', 'json_prompt'])
      add(
        'prompt',
        schemaAt(
          source,
          model.options.mode === 'json' ? 'json_prompt' : 'text_prompt'
        ),
        {
          label: model.options.mode === 'json' ? 'Structured prompt' : 'Prompt',
          help:
            model.options.mode === 'json'
              ? 'JSON layout and style instructions, sent as structured data.'
              : '',
          control: 'text-area',
          advanced: false,
          required: true
        }
      )
      request = {
        kind: 'callback',
        callback: 'ideogram',
        options: { mode: model.options.mode }
      }
      break
    case 'wan-media':
      request = wanCreatorRequest(id, model.options, fields)
      break
    default:
      throw new Error('Unknown creator form family')
  }
  for (const [name, value] of Object.entries(
    object.parse(model.options.fixedValues ?? {})
  )) {
    if (!Object.hasOwn(properties, name))
      throw new Error(`Unknown fixed creator input: ${id}:${name}`)
    rules[name] = {
      ...rules[name],
      fixed: z.union([z.string(), z.number(), z.boolean()]).parse(value)
    }
  }
  return fields.build(request)
}

export function creatorVariantsFor(
  id: string,
  curated: ReturnType<typeof curateWorkshopInputs>
) {
  return Object.fromEntries(
    [...workshopContentInputs].flatMap(([contentId, variant]) => {
      if (variant.routerId !== id || variant.unavailableReason) return []
      const form = creatorFormFor(id, curated, variant.options)
      if (!form) throw new Error(`Missing creator form for ${contentId}`)
      return [[contentId, form]]
    })
  )
}
