import type { WorkshopCreatorForm } from './workshop-creator-form'
import type {
  EncodedWorkshopFile,
  WorkshopRequestInputs
} from './workshop-creator-request'
import { WorkshopRouterError } from './workshop-router-errors'

type CallbackRequest = Extract<
  WorkshopCreatorForm['request'],
  { kind: 'callback' }
>
type Values = WorkshopRequestInputs['values']

function prefixed(values: Values, prefix: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, value]) => [name.slice(prefix.length), value])
  )
}

function dataUrl(file: EncodedWorkshopFile): string {
  return `data:${file.mimeType};base64,${file.data}`
}

function requireInput(values: Values, name: string): string | number | boolean {
  const value = values[name]
  if (value === undefined || value === '')
    throw new WorkshopRouterError('validation', null, { [name]: 'required' })
  return value
}

function seedance({
  values,
  files
}: WorkshopRequestInputs): Record<string, unknown> {
  const { prompt, ...body } = values
  const first = files.first_frame ?? []
  const last = files.last_frame ?? []
  const references = files.reference_images ?? []
  if (
    (last.length && !first.length) ||
    (references.length && (first.length || last.length))
  )
    throw new WorkshopRouterError('validation', null, {
      [last.length && !first.length ? 'first_frame' : 'reference_images']:
        'rejected'
    })
  return {
    ...body,
    content: [
      { type: 'text', text: prompt },
      ...[
        ...first.map((file) => ({ file, role: 'first_frame' })),
        ...last.map((file) => ({ file, role: 'last_frame' })),
        ...references.map((file) => ({ file, role: 'reference_image' }))
      ].map(({ file, role }) => ({
        type: 'image_url',
        role,
        image_url: { url: dataUrl(file) }
      }))
    ]
  }
}

function gemini({
  values,
  files
}: WorkshopRequestInputs): Record<string, unknown> {
  const imageConfig = prefixed(values, 'image_')
  return {
    contents: [
      {
        role: 'user',
        parts: [
          { text: values.prompt },
          ...(files.images ?? []).map((file) => ({
            inlineData: { data: file.data, mimeType: file.mimeType }
          }))
        ]
      }
    ],
    generationConfig: {
      ...prefixed(values, 'config_'),
      responseModalities: ['TEXT', 'IMAGE'],
      ...(Object.keys(imageConfig).length ? { imageConfig } : {})
    }
  }
}

function wan(
  request: CallbackRequest,
  { values }: WorkshopRequestInputs
): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt: values.prompt }
  if (values.negative_prompt) input.negative_prompt = values.negative_prompt
  const mode = request.options.mode
  if (mode === 'image-edit') input.images = [requireInput(values, 'image_url')]
  if (mode === 'image') {
    const url = requireInput(values, 'image_url')
    if (request.options.imageInMedia)
      input.media = [{ type: 'first_frame', url }]
    else input.img_url = url
  }
  if (mode === 'reference-video')
    input.reference_video_urls = [requireInput(values, 'video_url')]
  if (mode === 'reference' || mode === 'edit')
    input.media = [
      {
        type: mode === 'edit' ? 'video' : 'reference_image',
        url: requireInput(values, mode === 'edit' ? 'video_url' : 'image_url')
      },
      ...(mode === 'edit' && values.image_url
        ? [{ type: 'reference_image', url: values.image_url }]
        : [])
    ]
  return { input, parameters: prefixed(values, 'param_') }
}

function veo({
  values,
  files
}: WorkshopRequestInputs): Record<string, unknown> {
  const image = files.first_frame?.at(0)
  const lastFrame = files.last_frame?.at(0)
  const references = files.reference_images ?? []
  if ((lastFrame && !image) || (references.length && image))
    throw new WorkshopRouterError('validation', null, {
      [lastFrame && !image ? 'first_frame' : 'reference_images']: 'rejected'
    })
  function encoded(file: EncodedWorkshopFile) {
    return { bytesBase64Encoded: file.data, mimeType: file.mimeType }
  }
  return {
    instances: [
      {
        prompt: values.prompt,
        ...(image ? { image: encoded(image) } : {}),
        ...(lastFrame ? { lastFrame: encoded(lastFrame) } : {}),
        ...(references.length
          ? {
              referenceImages: references.map((file) => ({
                image: encoded(file),
                referenceType: 'asset'
              }))
            }
          : {})
      }
    ],
    parameters: prefixed(values, 'param_')
  }
}

export function prepareWorkshopRequestCallback(
  request: CallbackRequest,
  context: WorkshopRequestInputs
): Record<string, unknown> {
  const { values, files } = context
  switch (request.callback) {
    case 'flat':
      return { ...values }
    case 'seedance':
      return seedance(context)
    case 'gemini-image':
      return gemini(context)
    case 'wan-media':
      return wan(request, context)
    case 'veo':
      return veo(context)
    case 'seedream': {
      const images = (files.images ?? []).map(dataUrl)
      if (values.layer_decomposition && images.length !== 1)
        throw new WorkshopRouterError('validation', null, {
          images: 'rejected'
        })
      return {
        ...values,
        ...(images.length
          ? { image: images.length === 1 ? images[0] : images }
          : {})
      }
    }
    case 'qwen-image':
      return {
        input: {
          messages: [
            {
              role: 'user',
              content: [
                ...['image_url', 'image_url_2', 'image_url_3'].flatMap(
                  (name) => (values[name] ? [{ image: values[name] }] : [])
                ),
                { text: values.prompt }
              ]
            }
          ]
        },
        parameters: prefixed(values, 'param_')
      }
    case 'bria-edit': {
      const { prompt, image_url, mask_url, ...body } = values
      return {
        ...body,
        instruction: prompt,
        images: [image_url],
        ...(mask_url ? { mask: mask_url } : {})
      }
    }
    case 'runway-image': {
      const images = (files.images ?? []).map(dataUrl)
      if (request.options.mode === 'first-frame')
        return { ...values, promptImage: images[0] }
      return {
        ...values,
        ...(images.length
          ? { referenceImages: images.map((uri) => ({ uri })) }
          : {})
      }
    }
    case 'tencent-file': {
      const { file_type, file_url, Prompt, ...body } = values
      const image = files.image?.at(0)
      if (
        request.options.field === 'File3D' &&
        request.options.texture === true &&
        !image &&
        !Prompt
      )
        throw new WorkshopRouterError('validation', null, {
          Prompt: 'required'
        })
      if (image && values.EnablePBR === true)
        throw new WorkshopRouterError('validation', null, {
          EnablePBR: 'rejected'
        })
      return {
        ...body,
        [request.options.field === 'File3D' ? 'File3D' : 'File']: {
          Type: file_type,
          Url: file_url
        },
        ...(image
          ? { Image: { Base64: image.data } }
          : Prompt
            ? { Prompt }
            : {})
      }
    }
    case 'meshy-source': {
      const { model_url, input_task_id, target_format, ...body } = values
      if (Boolean(model_url) === Boolean(input_task_id))
        throw new WorkshopRouterError('validation', null, {
          model_url: 'rejected',
          input_task_id: 'rejected'
        })
      return {
        ...body,
        ...(model_url ? { model_url } : { input_task_id }),
        ...(target_format ? { target_formats: [target_format] } : {})
      }
    }
    case 'kling-avatar': {
      const { image_url, audio_url, ...body } = values
      return { ...body, image: image_url, sound_file: audio_url }
    }
    case 'kling-lip-sync':
      return {
        input: {
          mode: 'audio2video',
          audio_type: 'url',
          video_url: values.video_url,
          audio_url: values.audio_url
        }
      }
    case 'bfl-video': {
      const images = (files.images ?? []).map((file) => file.data)
      if (values.mode === 'i2v' && !images.length)
        throw new WorkshopRouterError('validation', null, {
          images: 'required'
        })
      if (values.mode === 'v2v') requireInput(values, 'start_video')
      if (values.mode !== 'i2v' && images.length)
        throw new WorkshopRouterError('validation', null, {
          images: 'rejected'
        })
      if (images.length > 2 && values.duration === 'auto')
        throw new WorkshopRouterError('validation', null, {
          duration: 'required'
        })
      const { start_video, ...body } = values
      return {
        ...body,
        ...(images.length ? { keyframes: images } : {}),
        ...(values.mode === 'v2v' ? { start_video } : {})
      }
    }
    case 'nested-settings':
      return { prompt: values.prompt, settings: prefixed(values, 'setting_') }
    case 'grok-video': {
      const { image_url, ...body } = values
      return { ...body, ...(image_url ? { image: { url: image_url } } : {}) }
    }
  }
}
