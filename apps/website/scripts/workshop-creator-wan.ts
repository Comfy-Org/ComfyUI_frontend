import { z } from 'astro/zod'

import type { WorkshopCreatorForm } from '../src/config/workshop-creator-form'
import type { createCreatorFields } from './workshop-creator-fields'
import { schemaAt } from './workshop-creator-fields'

const object = z.record(z.string(), z.json())

export function wanCreatorRequest(
  id: string,
  options: z.infer<typeof object>,
  fields: ReturnType<typeof createCreatorFields>
): WorkshopCreatorForm['request'] {
  const { source, properties, rules, prompt, settings, url } = fields
  prompt('input/prompt')
  if (!id.includes('wan3.0'))
    properties.prompt = {
      ...object.parse(properties.prompt),
      maxLength: id.includes('happyhorse') ? 2500 : 800
    }
  const params = object.parse(schemaAt(source, 'parameters').properties)
  const names = [
    'seed',
    'watermark',
    ...(id.includes('happyhorse') ? [] : ['prompt_extend']),
    ...(id.includes('2.5-')
      ? ['n', 'size']
      : [
          ...(id.endsWith('happyhorse-1.0-video-edit')
            ? ['audio_setting']
            : ['duration']),
          ...(id.includes('2.6-t2v') || id.includes('2.6-r2v')
            ? ['size']
            : ['resolution'])
        ])
  ].filter((name) => Object.hasOwn(params, name))
  settings('parameters', names, 'param_')
  if (Object.hasOwn(properties, 'param_size'))
    properties.param_size = {
      ...object.parse(properties.param_size),
      default: id.includes('2.5-') ? '1024*1024' : '1280*720'
    }
  if (Object.hasOwn(properties, 'param_resolution'))
    properties.param_resolution = {
      ...object.parse(properties.param_resolution),
      enum: id.includes('3.0') ? ['480P', '720P', '1080P'] : ['720P', '1080P'],
      default: '720P'
    }
  if (Object.hasOwn(properties, 'param_duration')) {
    const durations = id.includes('happyhorse')
      ? Array.from({ length: 13 }, (_, index) => index + 3)
      : id.includes('2.6-r2v')
        ? [5, 10]
        : id.includes('2.6')
          ? [5, 10, 15]
          : id.includes('2.7')
            ? Array.from(
                {
                  length:
                    options.mode === 'reference' || options.mode === 'edit'
                      ? 9
                      : 14
                },
                (_, index) => index + 2
              )
            : id.includes('3.0')
              ? Array.from({ length: 29 }, (_, index) => index + 2)
              : undefined
    if (durations)
      properties.param_duration = {
        ...object.parse(properties.param_duration),
        enum: durations
      }
  }
  if (Object.hasOwn(properties, 'param_duration'))
    rules.param_duration = {
      label: 'Duration',
      help: '',
      unit: 'seconds',
      advanced: false
    }
  if (Object.hasOwn(properties, 'param_resolution'))
    rules.param_resolution = {
      label: 'Resolution',
      help: '',
      advanced: false
    }
  if (Object.hasOwn(properties, 'param_size'))
    rules.param_size = { label: 'Size', help: '', advanced: false }
  if (['image', 'image-edit', 'reference'].includes(String(options.mode)))
    url(
      'image_url',
      options.mode === 'reference' ? 'Reference image' : 'Source image',
      true
    )
  if (['reference-video', 'edit'].includes(String(options.mode)))
    url('video_url', 'Source video', true, 'video')
  if (options.mode === 'edit') url('image_url', 'Reference image')
  return {
    kind: 'callback',
    callback: 'wan-media',
    options: {
      ...options,
      imageInMedia: id.includes('happyhorse') || id === 'wan/wan2.7-i2v'
    }
  }
}
