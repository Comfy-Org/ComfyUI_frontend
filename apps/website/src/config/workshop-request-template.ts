import { z } from 'astro/zod'

import { WorkshopRouterError } from './workshop-router-errors'

const argumentsSchema = z.tuple([z.string().min(1), z.json().optional()])
const object = z.record(z.string(), z.json())

function stringEnd(source: string, start: number): number {
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') index++
    else if (source[index] === '"') return index + 1
  }
  throw new Error('Unterminated template string')
}

function replacement(
  type: string,
  name: string,
  extra: unknown,
  inputs: Readonly<Record<string, unknown>>
): string {
  const value = Object.hasOwn(inputs, name) ? inputs[name] : undefined
  const valid =
    extra === undefined &&
    ((type === 'string' && typeof value === 'string') ||
      (type === 'number' &&
        typeof value === 'number' &&
        Number.isFinite(value)) ||
      (type === 'boolean' && typeof value === 'boolean') ||
      (type === 'json' && z.json().safeParse(value).success))
  if (!valid)
    throw new WorkshopRouterError('validation', null, {
      [name]: value === undefined ? 'required' : 'rejected'
    })
  return JSON.stringify(value)
}

export function renderWorkshopRequestTemplate(
  template: string,
  inputs: Readonly<Record<string, unknown>>
): Record<string, z.infer<ReturnType<typeof z.json>>> {
  const pieces: string[] = []
  let start = 0
  let index = 0
  while (index < template.length) {
    if (template[index] === '"') {
      index = stringEnd(template, index)
      continue
    }
    if (!template.startsWith('$repl_', index)) {
      index++
      continue
    }
    const match = /^\$repl_([a-z]+)\(/.exec(template.slice(index))
    if (!match) throw new Error('Invalid replacement token')
    const argumentStart = index + match[0].length
    let end = argumentStart
    while (end < template.length && template[end] !== ')')
      end = template[end] === '"' ? stringEnd(template, end) : end + 1
    if (end === template.length) throw new Error('Unterminated replacement')
    if (
      template
        .slice(end + 1)
        .trimStart()
        .startsWith(':')
    )
      throw new Error('Replacement tokens cannot be object keys')
    const args: unknown = JSON.parse(`[${template.slice(argumentStart, end)}]`)
    const [name, extra] = argumentsSchema.parse(args)
    pieces.push(
      template.slice(start, index),
      replacement(match[1], name, extra, inputs)
    )
    index = end + 1
    start = index
  }
  pieces.push(template.slice(start))
  const value: unknown = JSON.parse(pieces.join(''))
  return object.parse(value)
}
