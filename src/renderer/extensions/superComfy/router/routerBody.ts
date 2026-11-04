import type {
  SettingSpec,
  SettingValue
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { findRouterFamily } from '@/renderer/extensions/superComfy/router/routerFamilies'
import {
  setAt,
  withoutUndefined
} from '@/renderer/extensions/superComfy/router/routerJson'
import type {
  BodyOutcome,
  EncodedInputs,
  EncodedMedia,
  FixedValue,
  JsonObject,
  JsonValue,
  RouterContract,
  RouterPortSpec,
  RouterShape
} from '@/renderer/extensions/superComfy/router/routerTypes'

export const MAX_BODY_BYTES = 19.5 * 1024 * 1024

type ShapeBody = (contract: RouterContract, inputs: EncodedInputs) => JsonObject

function imagesOf(inputs: EncodedInputs): EncodedMedia[] {
  return inputs.media.image ?? []
}

function promptOf(inputs: EncodedInputs): string {
  return inputs.text.prompt ?? ''
}

function systemOf(inputs: EncodedInputs): string | undefined {
  return inputs.text.system || undefined
}

function mediaEntries(
  port: RouterPortSpec,
  items: readonly EncodedMedia[]
): [string, JsonValue][] {
  const data = items.map((item) => item.data)
  if (data.length === 0) return []
  if (port.numbered) {
    return port.numbered
      .slice(0, data.length)
      .map((key, index): [string, JsonValue] => [key, data[index]])
  }
  const field = port.field ?? port.name
  return [[field, port.multi ? data : data[0]]]
}

function portEntries(
  port: RouterPortSpec,
  inputs: EncodedInputs
): [string, JsonValue][] {
  if (port.modality !== 'text') {
    return mediaEntries(port, inputs.media[port.name] ?? [])
  }
  const text = inputs.text[port.name]
  return text ? [[port.field ?? port.name, text]] : []
}

const flatBody: ShapeBody = (contract, inputs) =>
  Object.fromEntries(
    contract.inputs.flatMap((port) => portEntries(port, inputs))
  )

const anthropicBody: ShapeBody = (_contract, inputs) =>
  withoutUndefined({
    messages: [
      {
        role: 'user',
        content: [
          ...imagesOf(inputs).map((image) => ({
            type: 'image',
            source: { type: 'base64', media_type: image.mime, data: image.data }
          })),
          { type: 'text', text: promptOf(inputs) }
        ]
      }
    ],
    system: systemOf(inputs)
  })

const openaiChatBody: ShapeBody = (_contract, inputs) => {
  const system = systemOf(inputs)
  return {
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      {
        role: 'user',
        content: [
          { type: 'text', text: promptOf(inputs) },
          ...imagesOf(inputs).map((image) => ({
            type: 'image_url',
            image_url: { url: image.data }
          }))
        ]
      }
    ]
  }
}

const openaiResponsesBody: ShapeBody = (_contract, inputs) =>
  withoutUndefined({
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: promptOf(inputs) },
          ...imagesOf(inputs).map((image) => ({
            type: 'input_image',
            image_url: image.data
          }))
        ]
      }
    ],
    instructions: systemOf(inputs)
  })

const geminiBody: ShapeBody = (_contract, inputs) => {
  const system = systemOf(inputs)
  return withoutUndefined({
    contents: [
      {
        role: 'user',
        parts: [
          { text: promptOf(inputs) },
          ...imagesOf(inputs).map((image) => ({
            inlineData: { mimeType: image.mime, data: image.data }
          }))
        ]
      }
    ],
    systemInstruction: system ? { parts: [{ text: system }] } : undefined
  })
}

const SHAPE_BODIES: Record<RouterShape, ShapeBody> = {
  flat: flatBody,
  anthropicMessages: anthropicBody,
  openaiChat: openaiChatBody,
  openaiResponses: openaiResponsesBody,
  geminiContents: geminiBody
}

function coerce(
  spec: SettingSpec,
  value: SettingValue | undefined
): SettingValue | undefined {
  if (value === undefined || value === '') return undefined
  if (spec.control !== 'number' || typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function settingValue(
  spec: SettingSpec,
  values: Record<string, SettingValue>
): SettingValue | undefined {
  const chosen = Object.hasOwn(values, spec.name)
    ? values[spec.name]
    : undefined
  return coerce(spec, chosen ?? (spec.required ? spec.default : undefined))
}

function placeSettings(
  body: JsonObject,
  contract: RouterContract,
  values: Record<string, SettingValue>
): JsonObject {
  return contract.settings.reduce((placed, spec) => {
    const path = contract.settingPaths[spec.name]
    const value = settingValue(spec, values)
    return path && value !== undefined ? setAt(placed, path, value) : placed
  }, body)
}

function placeFixed(body: JsonObject, fixed: readonly FixedValue[]) {
  return fixed.reduce(
    (placed, { path, value }) => setAt(placed, path, value),
    body
  )
}

function skeletonOf(
  contract: RouterContract,
  inputs: EncodedInputs,
  values: Record<string, SettingValue>
): BodyOutcome {
  if (contract.shape !== 'family') {
    return { ok: true, body: SHAPE_BODIES[contract.shape](contract, inputs) }
  }
  const family = findRouterFamily(contract.modelId)
  return family ? family.buildBody({ inputs, values }) : { ok: true, body: {} }
}

export function buildRouterBody(
  contract: RouterContract,
  inputs: EncodedInputs,
  values: Record<string, SettingValue>
): BodyOutcome {
  const skeleton = skeletonOf(contract, inputs, values)
  if (!skeleton.ok) return skeleton
  return {
    ok: true,
    body: placeFixed(
      placeSettings(skeleton.body, contract, values),
      contract.fixed
    )
  }
}

export function bodyBytes(body: JsonObject): number {
  return new TextEncoder().encode(JSON.stringify(body)).byteLength
}
