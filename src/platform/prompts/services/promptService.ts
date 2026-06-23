import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import {
  PROMPT_TAG,
  promptTemplateSchema
} from '@/platform/prompts/schemas/promptTypes'
import type {
  Prompt,
  PromptTemplate
} from '@/platform/prompts/schemas/promptTypes'

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

/** Coerces metadata the API may return as an object or a JSON string. */
function coerceObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === 'string' ? parseJson(value) : value
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {}
}

function coerceTemplate(value: unknown): PromptTemplate {
  const candidate = typeof value === 'string' ? parseJson(value) : value
  const parsed = promptTemplateSchema.safeParse(candidate)
  return parsed.success ? parsed.data : []
}

function stripTxt(name: string): string {
  return name.replace(/\.txt$/i, '')
}

function toFileName(name: string): string {
  return name.toLowerCase().endsWith('.txt') ? name : `${name}.txt`
}

function assetToPrompt(asset: AssetItem): Prompt {
  const metadata = coerceObject(asset.user_metadata)
  return {
    id: asset.id,
    name:
      readString(metadata.name) ?? stripTxt(asset.display_name ?? asset.name),
    template: coerceTemplate(metadata.template),
    description: readString(metadata.description)
  }
}

export async function fetchPrompts(): Promise<Prompt[]> {
  const assets = await assetService.getAllAssetsByTag(PROMPT_TAG)
  return assets.map(assetToPrompt)
}

/**
 * Loads a prompt's template from its file content, the reliably-persisted
 * source of truth (some backends drop user_metadata for text assets). Falls
 * back to treating non-JSON content as plain text for legacy prompts.
 */
export async function fetchPromptTemplate(id: string): Promise<PromptTemplate> {
  const content = await assetService.getAssetContent(id)
  const parsed = parseJson(content)
  const raw =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).template
      : parsed
  const template = coerceTemplate(raw)
  if (template.length) return template
  return content ? [{ type: 'text', value: content }] : []
}

export async function createPrompt(input: {
  name: string
  template: PromptTemplate
  description?: string
}): Promise<Prompt> {
  const content = JSON.stringify({
    name: input.name,
    template: input.template,
    ...(input.description ? { description: input.description } : {})
  })

  // Self-hosted asset APIs require the first tag to be a known category
  // (models/input/output); cloud accepts the bare prompt tag.
  const tags = isCloud ? [PROMPT_TAG] : ['input', PROMPT_TAG]

  const uploaded = await assetService.uploadAssetFromBase64({
    data: `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`,
    name: toFileName(input.name),
    tags,
    user_metadata: { name: input.name }
  })

  // The multipart upload does not reliably apply tags; ensure the prompt is
  // retrievable by tag after a reload.
  if (!uploaded.tags?.includes(PROMPT_TAG)) {
    await assetService.addAssetTags(uploaded.id, [PROMPT_TAG])
  }

  return {
    id: uploaded.id,
    name: input.name,
    template: input.template,
    description: input.description
  }
}
