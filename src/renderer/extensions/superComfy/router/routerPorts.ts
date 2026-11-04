import { capitalize, lowerCase } from 'es-toolkit'

import type { FileModality } from '@/renderer/extensions/superComfy/engine/documentSchema'
import type {
  RouterEncoding,
  RouterPortSpec
} from '@/renderer/extensions/superComfy/router/routerTypes'

export function humanizeKey(key: string): string {
  return capitalize(lowerCase(key))
}

export function textPort(
  name: string,
  options: { required?: boolean; field?: string } = {}
): RouterPortSpec {
  return {
    name,
    label: humanizeKey(name),
    modality: 'text',
    required: options.required ?? false,
    multi: false,
    inline: true,
    field: options.field
  }
}

interface MediaPortOptions {
  name: string
  modality: FileModality
  encoding: RouterEncoding
  required?: boolean
  max?: number
  field?: string
  numbered?: string[]
  labelKey?: string
}

export function mediaPort(options: MediaPortOptions): RouterPortSpec {
  const multi = options.max === undefined || options.max > 1
  return {
    name: options.name,
    label: humanizeKey(options.labelKey ?? options.name),
    modality: options.modality,
    required: options.required ?? false,
    multi,
    max: multi ? options.max : undefined,
    encoding: options.encoding,
    field: options.field,
    numbered: options.numbered
  }
}

export function singleMediaPort(
  options: Omit<MediaPortOptions, 'max'>
): RouterPortSpec {
  return mediaPort({ ...options, max: 1 })
}
